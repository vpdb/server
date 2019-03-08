/* tslint:disable:variable-name */
/*
 * VPDB - Virtual Pinball Database
 * Copyright (C) 2019 freezy <freezy@vpdb.io>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 */

import { BiffBlock, BiffParser } from './biff-parser';
import { GameItem } from './game-item';

export class PintableItem extends GameItem {

	public static async load(buffer: Buffer): Promise<PintableItem> {
		const pintableItem = new PintableItem();
		await pintableItem._load(buffer);
		return pintableItem;
	}

	private static BG_DESKTOP = 0;
	private static BG_FULLSCREEN = 1;
	private static BG_FSS = 2;

	public pdata: number[] = [];
	public left: number;
	public top: number;
	public right: number;
	public bottom: number;
	public BG_rotation: number[] = [];
	public BG_layback: number[] = [];
	public BG_inclination: number[] = [];
	public BG_FOV: number[] = [];
	public BG_scalex: number[] = [];
	public BG_scaley: number[] = [];
	public BG_scalez: number[] = [];
	public BG_xlatex: number[] = [];
	public BG_xlatey: number[] = [];
	public BG_xlatez: number[] = [];
	public BG_enable_FSS: boolean;
	public BG_current_set: number;
	public overridePhysics: number;
	public overridePhysicsFlipper: boolean;
	public Gravity: number;
	public friction: number;
	public elasticity: number;
	public elasticityFalloff: number;
	public scatter: number;
	public defaultScatter: number;
	public nudgeTime: number;
	public plungerNormalize: number;
	public plungerFilter: boolean;
	public PhysicsMaxLoops: number;
	public fRenderDecals: boolean;
	public fRenderEMReels: boolean;
	public offset: Vertex2D = new Vertex2D();
	public _3DmaxSeparation: number;
	public _3DZPD: number;
	public zoom: number;
	public _3DOffset: number;
	public overwriteGlobalStereo3D: boolean;
	public angletiltMax: number;
	public angletiltMin: number;
	public glassheight: number;
	public tableheight: number;
	public szImage: string;
	public szBallImage: string;
	public szBallImageFront: string;
	public szScreenShot: string;
	public fBackdrop: boolean;
	public wzName: string;
	public Light: LightSource[] = [ new LightSource() ];
	public BG_szImage: string[] = [];
	public ImageBackdropNightDay: boolean;
	public szImageColorGrade: string;
	public szEnvImage: string;
	public szPlayfieldMaterial: string;
	public lightAmbient: number;
	public lightHeight: number;
	public lightRange: number;
	public lightEmissionScale: number;
	public envEmissionScale: number;
	public globalEmissionScale: number;
	public AOScale: number;
	public SSRScale: number;
	public useReflectionForBalls: number;
	public playfieldReflectionStrength: number;
	public useTrailForBalls: number;
	public ballTrailStrength: number;
	public ballPlayfieldReflectionStrength: number;
	public defaultBulbIntensityScaleOnBall: number;
	public useAA: number;
	public useAO: number;
	public useSSR: number;
	public useFXAA: number;
	public bloom_strength: number;
	public colorbackdrop: number;
	public rgcolorcustom: number[];
	public globalDifficulty: number;
	public szT: string;
	public vCustomInfoTag: string[] = [];
	public TableSoundVolume: number;
	public BallDecalMode: boolean;
	public TableMusicVolume: number;
	public TableAdaptiveVSync: number;
	public overwriteGlobalDetailLevel: boolean;
	public overwriteGlobalDayNight: boolean;
	public fGrid: boolean;
	public fReflectElementsOnPlayfield: boolean;
	public userDetailLevel: number;
	public numMaterials: number;
	public materials: Material[] = [];

	public getName(): string {
		return this.wzName;
	}

	private async _load(buffer: Buffer) {
		const blocks = BiffParser.parseBiff(buffer, 4);
		for (const block of blocks) {
			switch (block.tag) {
				case 'PIID': this.pdata[0] = this.parseInt(block); break;
				case 'LEFT': this.left = this.parseFloat(block); break;
				case 'TOPX': this.top = this.parseFloat(block); break;
				case 'RGHT': this.right = this.parseFloat(block); break;
				case 'BOTM': this.bottom = this.parseFloat(block); break;
				case 'ROTA': this.BG_rotation[PintableItem.BG_DESKTOP] = this.parseFloat(block); break;
				case 'LAYB': this.BG_layback[PintableItem.BG_DESKTOP] = this.parseFloat(block); break;
				case 'INCL': this.BG_inclination[PintableItem.BG_DESKTOP] = this.parseFloat(block); break;
				case 'FOVX': this.BG_FOV[PintableItem.BG_DESKTOP] = this.parseFloat(block); break;
				case 'SCLX': this.BG_scalex[PintableItem.BG_DESKTOP] = this.parseFloat(block); break;
				case 'SCLY': this.BG_scaley[PintableItem.BG_DESKTOP] = this.parseFloat(block); break;
				case 'SCLZ': this.BG_scalez[PintableItem.BG_DESKTOP] = this.parseFloat(block); break;
				case 'XLTX': this.BG_xlatex[PintableItem.BG_DESKTOP] = this.parseFloat(block); break;
				case 'XLTY': this.BG_xlatey[PintableItem.BG_DESKTOP] = this.parseFloat(block); break;
				case 'XLTZ': this.BG_xlatez[PintableItem.BG_DESKTOP] = this.parseFloat(block); break;
				case 'ROTF': this.BG_rotation[PintableItem.BG_FULLSCREEN] = this.parseFloat(block); break;
				case 'LAYF': this.BG_layback[PintableItem.BG_FULLSCREEN] = this.parseFloat(block); break;
				case 'INCF': this.BG_inclination[PintableItem.BG_FULLSCREEN] = this.parseFloat(block); break;
				case 'FOVF': this.BG_FOV[PintableItem.BG_FULLSCREEN] = this.parseFloat(block); break;
				case 'SCFX': this.BG_scalex[PintableItem.BG_FULLSCREEN] = this.parseFloat(block); break;
				case 'SCFY': this.BG_scaley[PintableItem.BG_FULLSCREEN] = this.parseFloat(block); break;
				case 'SCFZ': this.BG_scalez[PintableItem.BG_FULLSCREEN] = this.parseFloat(block); break;
				case 'XLFX': this.BG_xlatex[PintableItem.BG_FULLSCREEN] = this.parseFloat(block); break;
				case 'XLFY': this.BG_xlatey[PintableItem.BG_FULLSCREEN] = this.parseFloat(block); break;
				case 'XLFZ': this.BG_xlatez[PintableItem.BG_FULLSCREEN] = this.parseFloat(block); break;
				case 'ROFS': this.BG_rotation[PintableItem.BG_FSS] = this.parseFloat(block); break;
				case 'LAFS': this.BG_layback[PintableItem.BG_FSS] = this.parseFloat(block); break;
				case 'INFS': this.BG_inclination[PintableItem.BG_FSS] = this.parseFloat(block); break;
				case 'FOFS': this.BG_FOV[PintableItem.BG_FSS] = this.parseFloat(block); break;
				case 'SCXS': this.BG_scalex[PintableItem.BG_FSS] = this.parseFloat(block); break;
				case 'SCYS': this.BG_scaley[PintableItem.BG_FSS] = this.parseFloat(block); break;
				case 'SCZS': this.BG_scalez[PintableItem.BG_FSS] = this.parseFloat(block); break;
				case 'XLXS': this.BG_xlatex[PintableItem.BG_FSS] = this.parseFloat(block); break;
				case 'XLYS': this.BG_xlatey[PintableItem.BG_FSS] = this.parseFloat(block); break;
				case 'XLZS': this.BG_xlatez[PintableItem.BG_FSS] = this.parseFloat(block); break;
				case 'EFSS':
					this.BG_enable_FSS = this.parseBool(block);
					if (this.BG_enable_FSS) {
						this.BG_current_set = PintableItem.BG_FSS;
					}
					break;
				case 'ORRP': this.overridePhysics = this.parseInt(block); break;
				case 'ORPF': this.overridePhysicsFlipper = this.parseBool(block); break;
				case 'GAVT': this.Gravity = this.parseFloat(block); break;
				case 'FRCT': this.friction = this.parseFloat(block); break;
				case 'ELAS': this.elasticity = this.parseFloat(block); break;
				case 'ELFA': this.elasticityFalloff = this.parseFloat(block); break;
				case 'PFSC': this.scatter = this.parseFloat(block); break;
				case 'SCAT': this.defaultScatter = this.parseFloat(block); break;
				case 'NDGT': this.nudgeTime = this.parseFloat(block); break;
				case 'MPGC': this.plungerNormalize = this.parseInt(block); break;
				case 'MPDF': this.plungerFilter = this.parseBool(block); break;
				case 'PHML': this.PhysicsMaxLoops = this.parseInt(block); break;
				case 'DECL': this.fRenderDecals = this.parseBool(block); break;
				case 'REEL': this.fRenderEMReels = this.parseBool(block); break;
				case 'OFFX': this.offset.x = this.parseFloat(block); break;
				case 'OFFY': this.offset.y = this.parseFloat(block); break;
				case 'ZOOM': this.zoom = this.parseFloat(block); break;
				case 'MAXSEP': this._3DmaxSeparation = this.parseFloat(block); break;
				case 'ZPD': this._3DZPD = this.parseFloat(block); break;
				case 'STO': this._3DOffset = this.parseFloat(block); break;
				case 'OGST': this.overwriteGlobalStereo3D = this.parseBool(block); break;
				case 'SLPX': this.angletiltMax = this.parseFloat(block); break;
				case 'SLOP': this.angletiltMin = this.parseFloat(block); break;
				case 'GLAS': this.glassheight = this.parseFloat(block); break;
				case 'TBLH': this.tableheight = this.parseFloat(block); break;
				case 'IMAG': this.szImage = this.parseString(block); break;
				case 'BLIM': this.szBallImage = this.parseString(block); break;
				case 'BLIF': this.szBallImageFront = this.parseString(block); break;
				case 'SSHT': this.szScreenShot = this.parseString(block); break;
				case 'FBCK': this.fBackdrop = this.parseBool(block); break;
				case 'SEDT': this.pdata[1] = this.parseInt(block); break;
				case 'SSND': this.pdata[2] = this.parseInt(block); break;
				case 'SIMG': this.pdata[3] = this.parseInt(block); break;
				case 'SFNT': this.pdata[4] = this.parseInt(block); break;
				case 'SCOL': this.pdata[5] = this.parseInt(block); break;
				case 'NAME': this.wzName = this.parseWideString(block); break;
				case 'BIMG': this.BG_szImage[PintableItem.BG_DESKTOP] = this.parseString(block); break;
				case 'BIMF': this.BG_szImage[PintableItem.BG_FULLSCREEN] = this.parseString(block); break;
				case 'BIMS': this.BG_szImage[PintableItem.BG_FSS] = this.parseString(block); break;
				case 'BIMN': this.ImageBackdropNightDay = this.parseBool(block); break;
				case 'IMCG': this.szImageColorGrade = this.parseString(block); break;
				case 'EIMG': this.szEnvImage = this.parseString(block); break;
				case 'PLMA': this.szPlayfieldMaterial = this.parseString(block); break;
				case 'LZAM': this.lightAmbient = this.parseInt(block); break;
				case 'LZDI': this.Light[0].emission = this.parseInt(block); break;
				case 'LZHI': this.lightHeight = this.parseFloat(block); break;
				case 'LZRA': this.lightRange = this.parseFloat(block); break;
				case 'LIES': this.lightEmissionScale = this.parseFloat(block); break;
				case 'ENES': this.envEmissionScale = this.parseFloat(block); break;
				case 'GLES': this.globalEmissionScale = this.parseFloat(block); break;
				case 'AOSC': this.AOScale = this.parseFloat(block); break;
				case 'SSSC': this.SSRScale = this.parseFloat(block); break;
				case 'BREF': this.useReflectionForBalls = this.parseInt(block); break;
				case 'PLST': this.playfieldReflectionStrength = this.parseInt(block); break; // m_playfieldReflectionStrength = dequantizeUnsigned<8>(tmp);
				case 'BTRA': this.useTrailForBalls = this.parseInt(block); break;
				case 'BTST': this.ballTrailStrength = this.parseInt(block); break; // m_ballTrailStrength = dequantizeUnsigned<8>(tmp);
				case 'BPRS': this.ballPlayfieldReflectionStrength = this.parseFloat(block); break;
				case 'DBIS': this.defaultBulbIntensityScaleOnBall = this.parseFloat(block); break;
				case 'UAAL': this.useAA = this.parseInt(block); break;
				case 'UAOC': this.useAO = this.parseInt(block); break;
				case 'USSR': this.useSSR = this.parseInt(block); break;
				case 'UFXA': this.useFXAA = this.parseFloat(block); break;
				case 'BLST': this.bloom_strength = this.parseFloat(block); break;
				case 'BCLR': this.colorbackdrop = this.parseInt(block); break;
				case 'CCUS': this.rgcolorcustom = this.parseUnsignedInt4s(block.data, 16); break;
				case 'TDFT': this.globalDifficulty = this.parseFloat(block); break;
				case 'CUST': this.szT = this.parseString(block); this.vCustomInfoTag.push(this.szT); break;
				case 'SVOL': this.TableSoundVolume = this.parseFloat(block); break;
				case 'BDMO': this.BallDecalMode = this.parseBool(block); break;
				case 'MVOL': this.TableMusicVolume = this.parseFloat(block); break;
				case 'AVSY': this.TableAdaptiveVSync = this.parseInt(block); break;
				case 'OGAC': this.overwriteGlobalDetailLevel = this.parseBool(block); break;
				case 'OGDN': this.overwriteGlobalDayNight = this.parseBool(block); break;
				case 'GDAC': this.fGrid = this.parseBool(block); break;
				case 'REOP': this.fReflectElementsOnPlayfield = this.parseBool(block); break;
				case 'ARAC': this.userDetailLevel = this.parseInt(block); break;
				case 'MASI': this.numMaterials = this.parseInt(block); break;
				case 'MATE':
					for (let i = 0; i < this.numMaterials; i++) {
						const saveMat = new SaveMaterial(block.data, i);
						this.materials.push(Material.from(saveMat));
					}
					break;

				case 'PHMA':
					for (let i = 0; i < this.numMaterials; i++) {
						const savePhysMat = new SavePhysicsMaterial(block.data, i);
						this.materials.find(m => m.szName === savePhysMat.szName).physUpdate(savePhysMat);
					}
					break;

				default:
					this.parseUnknownBlock(block);
					break;
			}
		}
	}
}

class Vertex2D {

	public static load(block: BiffBlock) {
		const v2 = new Vertex2D();
		v2.x = block.data.readFloatLE(0);
		v2.y = block.data.readFloatLE(4);
		return v2;
	}

	public static from(data: any): Vertex2D {
		return Object.assign(new Vertex2D(), data);
	}

	public x: number;
	public y: number;
}

class Vertex3D {

	public static load(block: BiffBlock) {
		const v3 = new Vertex3D();
		v3.x = block.data.readFloatLE(0);
		v3.y = block.data.readFloatLE(4);
		v3.z = block.data.readFloatLE(8);
		return v3;
	}

	public static from(data: any): Vertex3D {
		return Object.assign(new Vertex3D(), data);
	}

	public x: number;
	public y: number;
	public z: number;
}

class LightSource {

	public static load(block: BiffBlock) {
		const v2 = new Vertex2D();
		v2.x = block.data.readFloatLE(0);
		v2.y = block.data.readFloatLE(4);
		return v2;
	}

	public static from(data: any): Vertex2D {
		return Object.assign(new Vertex2D(), data);
	}

	public emission: number;
	public pos: Vertex3D;
}

class SaveMaterial {

	public static size = 80;

	public szName: string;
	public cBase: number; // can be overriden by texture on object itself
	public cGlossy: number; // specular of glossy layer
	public cClearcoat: number; // specular of clearcoat layer
	public fWrapLighting: number; // wrap/rim lighting factor (0(off)..1(full))
	public bIsMetal: boolean; // is a metal material or not
	public fRoughness: number; // roughness of glossy layer (0(diffuse)..1(specular))
	public fGlossyImageLerp: number; // use image also for the glossy layer (0(no tinting at all)..1(use image)), stupid quantization because of legacy loading/saving
	public fEdge: number; // edge weight/brightness for glossy and clearcoat (0(dark edges)..1(full fresnel))
	public fThickness: number; // thickness for transparent materials (0(paper thin)..1(maximum)), stupid quantization because of legacy loading/saving
	public fOpacity: number; // opacity (0..1)
	public bOpacityActive_fEdgeAlpha: number;

	constructor(buffer: Buffer, i = 0) {
		const offset = i * SaveMaterial.size;
		this.szName = buffer.slice(offset, offset + 32).toString('utf8');
		this.cBase = buffer.readInt32LE(offset + 32);
		this.cGlossy = buffer.readInt32LE(offset + 36);
		this.cClearcoat = buffer.readInt32LE(offset + 40);
		this.fWrapLighting = buffer.readFloatLE(offset + 44);
		this.bIsMetal =  buffer.readInt32LE(offset + 50) > 0;
		this.fRoughness =  buffer.readFloatLE(offset + 54);
		this.fGlossyImageLerp =  buffer.readInt32LE(offset + 60);
		this.fEdge =  buffer.readFloatLE(offset + 64);
		this.fThickness =  buffer.readInt32LE(offset + 68);
		this.fOpacity =  buffer.readFloatLE(offset + 72);
		this.bOpacityActive_fEdgeAlpha =  buffer.readInt32LE(offset + 76);
	}
}

class SavePhysicsMaterial {

	public static size = 48;

	public szName: string;
	public fElasticity: number;
	public fElasticityFallOff: number;
	public fFriction: number;
	public fScatterAngle: number;

	constructor(buffer: Buffer, i = 0) {
		const offset = i * SavePhysicsMaterial.size;
		this.szName = buffer.slice(offset, offset + 32).toString('utf8');
		this.fElasticity =  buffer.readFloatLE(offset + 32);
		this.fElasticityFallOff =  buffer.readFloatLE(offset + 36);
		this.fFriction =  buffer.readFloatLE(offset + 40);
		this.fScatterAngle =  buffer.readFloatLE(offset + 44);
	}
}

class Material {

	public static from(saveMaterial: SaveMaterial): Material {
		const material = new Material();
		material.cBase = saveMaterial.cBase;
		material.cGlossy = saveMaterial.cGlossy;
		material.cClearcoat = saveMaterial.cClearcoat;
		material.fWrapLighting = saveMaterial.fWrapLighting;
		material.fRoughness = saveMaterial.fRoughness;
		material.fGlossyImageLerp = 0; //1.0f - dequantizeUnsigned<8>(mats[i].fGlossyImageLerp); //!! '1.0f -' to be compatible with previous table versions
		material.fThickness = 0; //(mats[i].fThickness == 0) ? 0.05f : dequantizeUnsigned<8>(mats[i].fThickness); //!! 0 -> 0.05f to be compatible with previous table versions
		material.fEdge = saveMaterial.fEdge;
		material.fOpacity = saveMaterial.fOpacity;
		material.bIsMetal = saveMaterial.bIsMetal;
		material.bOpacityActive = false; //!!(saveMaterial.bOpacityActive_fEdgeAlpha & 1);
		material.fEdgeAlpha = 0; //dequantizeUnsigned<7>(mats[i].bOpacityActive_fEdgeAlpha >> 1);
		material.szName = saveMaterial.szName;
		return material;
	}

	public szName: string;
	public fWrapLighting: number;
	public fRoughness: number;
	public fGlossyImageLerp: number;
	public fThickness: number;
	public fEdge: number;
	public fEdgeAlpha: number;
	public fOpacity: number;
	public cBase: number;
	public cGlossy: number;
	public cClearcoat: number;
	public bIsMetal: boolean;
	public bOpacityActive: boolean;

	//physics
	public fElasticity: number;
	public fElasticityFalloff: number;
	public fFriction: number;
	public fScatterAngle: number;

	public physUpdate(savePhysMat: SavePhysicsMaterial) {
		this.fElasticity = savePhysMat.fElasticity;
		this.fElasticityFalloff = savePhysMat.fElasticityFallOff;
		this.fFriction = savePhysMat.fFriction;
		this.fScatterAngle = savePhysMat.fScatterAngle;
	}
}
