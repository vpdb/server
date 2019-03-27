const MAX_CODES = 4095;
const FILE_BUF_SIZE = 4096;
const CODE_MASK = [
	0,
	0x0001, 0x0003,
	0x0007, 0x000F,
	0x001F, 0x003F,
	0x007F, 0x00FF,
	0x01FF, 0x03FF,
	0x07FF, 0x0FFF
];

export class LzwReader {

	pstm: BufferPtr;

	msDelayCur: number;

	/* output */
	pbBitsOutCur: BufferPtr;
	cbStride: number;
	bad_code_count: number;

	/* Static variables */
	curr_size: number;                 /* The current code size */
	clear: number;                     /* Value for a clear code */
	ending: number;                    /* Value for a ending code */
	newcodes: number;                  /* First available code */
	top_slot: number;                  /* Highest code for current size */
	slot: number;                      /* Last read code */

	/* The following static variables are used
	 * for seperating out codes
	 */
	navail_bytes: number;              /* # bytes left in block */
	nbits_left: number;                /* # bits left in current byte */
	b1: number;                       /* Current byte */
	byte_buff = Buffer.alloc(257);           /* Current block */
	pbytes: BufferPtr;                  /* points to byte_buff - Pointer to next byte in block */

	stack = Buffer.alloc(MAX_CODES + 1);     /* Stack for storing pixels */
	suffix = Buffer.alloc(MAX_CODES + 1);    /* Suffix table */
	prefix: number[] = [];   /* Prefix linked list */

	cfilebuffer: number;

	width: number;
	height: number;
	linesleft: number;

	readahead: number; // How many

	constructor(pstm: Buffer, width: number, height: number, pitch: number) {
		for (let i = 0; i < MAX_CODES + 1; i++) {
			this.prefix[i] = 0;
		}
		this.cbStride = pitch;
		this.pbBitsOutCur = new BufferPtr(Buffer.alloc(pitch * height));

		this.bad_code_count = 0;

		this.cfilebuffer = FILE_BUF_SIZE - 1;
		this.readahead = FILE_BUF_SIZE;

		this.pstm = new BufferPtr(pstm);

		this.width = width; // 32-bit picture
		this.height = height;
		this.linesleft = height + 1; // +1 because 1 gets taken o
		console.log('+++ lzw reader initialized at %sx%s with destination of %s bytes.', this.width, this.height, this.pbBitsOutCur.getBuffer().length);
	}

	public decompress(): Buffer {

		let sp: BufferPtr; // points to this.stack
		let bufptr: BufferPtr; // points to this.buf
		let buf: BufferPtr;
		let bufcnt: number;

		let c, oc, fc, code, size: number;

		/* Initialize for decoding a new image...
		 */
		/*if ((size = get_byte()) < 0)
		   return (size);
		   if (size < 2 || 9 < size)
		   return (BAD_CODE_SIZE);*/
		size = 8;
		this.init_exp(size);

		/* Initialize in case they forgot to put in a clear code.
		 * (This shouldn't happen, but we'll try and decode it anyway...)
		 */
		oc = fc = 0;

		/* Allocate space for the decode buffer
		 */
		buf = this.NextLine();

		/* Set up the stack pointer and decode buffer pointer
		 */
		sp = new BufferPtr(this.stack);
		bufptr = BufferPtr.fromPtr(buf);
		bufcnt = this.width;

		/* This is the main loop.  For each code we get we pass through the
		 * linked list of prefix codes, pushing the corresponding "character" for
		 * each code onto the stack.  When the list reaches a single "character"
		 * we push that on the stack too, and then start unstacking each
		 * character for output in the correct order.  Special handling is
		 * included for the clear code, and the whole thing ends when we get
		 * an ending code.
		 */
		while ((c = this.get_next_code()) !== this.ending) {

			/* If we had a file error, return without completing the decode
			 */
			if (c < 0) {
				break;
				//return (0);
			}

			/* If the code is a clear code, reinitialize all necessary items.
			 */
			if (c === this.clear) {
				this.curr_size = size + 1;
				this.slot = this.newcodes;
				this.top_slot = 1 << this.curr_size;

				/* Continue reading codes until we get a non-clear code
				 * (Another unlikely, but possible case...)
				 */
				while ((c = this.get_next_code()) === this.clear) {
					// do nothing
				}

				/* If we get an ending code immediately after a clear code
				 * (Yet another unlikely case), then break out of the loop.
				 */
				if (c === this.ending) {
					break;
				}

				/* Finally, if the code is beyond the range of already set codes,
				 * (This one had better NOT happen...  I have no idea what will
				 * result from this, but I doubt it will look good...) then set it
				 * to color zero.
				 */
				if (c >= this.slot) {
					c = 0;
				}

				oc = fc = c;

				/* And let us not forget to put the char into the buffer... And
				 * if, on the off chance, we were exactly one pixel from the end
				 * of the line, we have to send the buffer to the out_line()
				 * routine...
				 */
				if (bufptr.getPos()) {
					bufptr.set(c);
					bufptr.incr();
				}

				if (--bufcnt == 0) {
					buf = this.NextLine();
					bufptr = BufferPtr.fromPtr(buf);
					bufcnt = this.width;
				}

			} else {

				/* In this case, it's not a clear code or an ending code, so
				 * it must be a code code...  So we can now decode the code into
				 * a stack of character codes. (Clear as mud, right?)
				 */
				code = c;

				/* Here we go again with one of those off chances...  If, on the
				 * off chance, the code we got is beyond the range of those already
				 * set up (Another thing which had better NOT happen...) we trick
				 * the decoder into thinking it actually got the last code read.
				 * (Hmmn... I'm not sure why this works...  But it does...)
				 */
				if (code >= this.slot) {
					if (code > this.slot) {
						++this.bad_code_count;
					}
					code = oc;
					sp.set(fc);
					sp.incr();
				}

				/* Here we scan back along the linked list of prefixes, pushing
				 * helpless characters (ie. suffixes) onto the stack as we do so.
				 */
				while (code >= this.newcodes) {
					sp.set(this.suffix[code]);
					sp.incr();
					code = this.prefix[code];
				}

				/* Push the last character on the stack, and set up the new
				 * prefix and suffix, and if the required slot number is greater
				 * than that allowed by the current bit size, increase the bit
				 * size.  (NOTE - If we are all full, we *don't* save the new
				 * suffix and prefix...  I'm not certain if this is correct...
				 * it might be more proper to overwrite the last code...
				 */
				sp.set(code);
				sp.incr();
				if (this.slot < this.top_slot) {
					fc = code;
					this.suffix[this.slot] = fc;	// = code;
					this.prefix[this.slot++] = oc;
					oc = c;
				}
				if (this.slot >= this.top_slot)
					if (this.curr_size < 12) {
						this.top_slot <<= 1;
						++this.curr_size;
					}

				/* Now that we've pushed the decoded string (in reverse order)
				 * onto the stack, lets pop it off and put it into our decode
				 * buffer...  And when the decode buffer is full, write another
				 * line...
				 */
				while (sp.getPos() > 0) {

					sp.decr();
					bufptr.set(sp.get());
					bufptr.incr();
					if (--bufcnt == 0) {
						buf = this.NextLine();
						bufptr = buf;
						bufcnt = this.width;
					}
				}
			}
		}

		//!! BUG - is all this necessary?  Is it correct?
		let toofar = this.readahead - this.cfilebuffer; // bytes we already read that we shouldn't have
		toofar--;  // m_readahead == the byte we just read, so we actually used up one more than the math shows

		return this.pbBitsOutCur.getBuffer();
	}

	private init_exp(size: number): void {
		this.curr_size = size + 1;
		this.top_slot = 1 << this.curr_size;
		this.clear = 1 << size;
		this.ending = this.clear + 1;
		this.slot = this.newcodes = this.ending + 1;
		this.navail_bytes = this.nbits_left = 0;
	}

	private NextLine(): BufferPtr {
		const pbRet = BufferPtr.fromPtr(this.pbBitsOutCur);
		this.pbBitsOutCur.incr(this.cbStride);	// fucking upside down dibs!
		this.linesleft--;
		return pbRet;
	}

	private get_next_code(): number {
		let ret: number;
		if (this.nbits_left === 0) {
			if (this.navail_bytes <= 0) {

				/* Out of bytes in current block, so read next block
				 */
				this.pbytes = new BufferPtr(this.byte_buff);
				if ((this.navail_bytes = this.get_byte()) < 0) {
					return (this.navail_bytes);

				} else if (this.navail_bytes) {
					for (let i = 0; i < this.navail_bytes; ++i) {
						let x = this.get_byte();
						if (x < 0) {
							return x;
						}
						this.byte_buff[i] = x;
					}
				}
			}
			this.b1 = this.pbytes.get();
			this.pbytes.incr();
			this.nbits_left = 8;
			--this.navail_bytes;
		}

		ret = this.b1 >> (8 - this.nbits_left);
		while (this.curr_size > this.nbits_left) {
			if (this.navail_bytes <= 0) {

				/* Out of bytes in current block, so read next block
				 */
				this.pbytes = new BufferPtr(this.byte_buff);
				if ((this.navail_bytes = this.get_byte()) < 0) {
					return this.navail_bytes;

				} else if (this.navail_bytes) {
					for (let i = 0; i < this.navail_bytes; ++i) {
						let x = this.get_byte();
						if (x < 0) {
							return x;
						}
						this.byte_buff[i] = x;
					}
				}
			}
			this.b1 = this.pbytes.get();
			this.pbytes.incr();
			ret |= this.b1 << this.nbits_left;
			this.nbits_left += 8;
			--this.navail_bytes;
		}
		this.nbits_left -= this.curr_size;
		ret &= CODE_MASK[this.curr_size];
		return ret;
	}

	private get_byte(): number {
		return this.pstm.next();
	}
}

class BufferPtr {
	private readonly buf: Buffer;
	private pos: number;

	constructor(buf: Buffer, pos: number = 0) {
		this.buf = buf;
		this.pos = pos;
	}

	public static fromPtr(ptr: BufferPtr) {
		return new BufferPtr(ptr.buf, ptr.pos)
	}

	public incr(offset: number = 1) {
		this.pos += offset;
	}

	public decr(offset: number = 1) {
		this.pos -= offset;
	}

	public get(offset: number = -1): number {
		return this.buf[offset > -1 ? offset : this.pos];
	}

	public next(): number {
		return this.buf[++this.pos];
	}

	public set(value: number) {
		this.buf[this.pos] = value;
	}

	public setPos(pos: number) {
		this.pos = pos;
	}

	public getPos(): number {
		return this.pos;
	}

	public getBuffer(): Buffer {
		return this.buf;
	}
}