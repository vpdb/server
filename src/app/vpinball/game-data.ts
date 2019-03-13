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
import { Vertex2D, Vertex3D } from './common';

export class GameData extends BiffParser {

	public static async load(buffer: Buffer): Promise<GameData> {
		const gameData = new GameData();
		await gameData._load(buffer);
		return gameData;
	}

	public static from(data: any): GameData {
		const gameData = new GameData();
		Object.assign(gameData, data);
		gameData.materials = [];
		for (const material of data.materials) {
			gameData.materials.push(Material.fromCached(material));
		}
		return gameData;
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
	public numGameItems: number;
	public numSounds: number;
	public numTextures: number;
	public numFonts: number;
	public numCollections: number;
	public script: string;
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

	public serialize() {
		return {
			table_height: this.tableheight,
			size: {
				width: this.right - this.left,
				height: this.bottom - this.top,
			},
			glass_height: this.glassheight,
			offset: this.offset,
			light: {
				ambient: this.lightAmbient,
				height: this.lightHeight,
				range: this.lightRange,
				emmission_scale: this.lightEmissionScale,
			},
			textureMap: this.szImage,
			material: this.szPlayfieldMaterial,
		};
	}

	private async _load(buffer: Buffer) {
		const blocks = BiffParser.parseBiff(buffer);
		for (const block of blocks) {
			switch (block.tag) {
				case 'PIID': this.pdata[0] = this.parseInt(buffer, block); break;
				case 'LEFT': this.left = this.parseFloat(buffer, block); break;
				case 'TOPX': this.top = this.parseFloat(buffer, block); break;
				case 'RGHT': this.right = this.parseFloat(buffer, block); break;
				case 'BOTM': this.bottom = this.parseFloat(buffer, block); break;
				case 'ROTA': this.BG_rotation[GameData.BG_DESKTOP] = this.parseFloat(buffer, block); break;
				case 'LAYB': this.BG_layback[GameData.BG_DESKTOP] = this.parseFloat(buffer, block); break;
				case 'INCL': this.BG_inclination[GameData.BG_DESKTOP] = this.parseFloat(buffer, block); break;
				case 'FOVX': this.BG_FOV[GameData.BG_DESKTOP] = this.parseFloat(buffer, block); break;
				case 'SCLX': this.BG_scalex[GameData.BG_DESKTOP] = this.parseFloat(buffer, block); break;
				case 'SCLY': this.BG_scaley[GameData.BG_DESKTOP] = this.parseFloat(buffer, block); break;
				case 'SCLZ': this.BG_scalez[GameData.BG_DESKTOP] = this.parseFloat(buffer, block); break;
				case 'XLTX': this.BG_xlatex[GameData.BG_DESKTOP] = this.parseFloat(buffer, block); break;
				case 'XLTY': this.BG_xlatey[GameData.BG_DESKTOP] = this.parseFloat(buffer, block); break;
				case 'XLTZ': this.BG_xlatez[GameData.BG_DESKTOP] = this.parseFloat(buffer, block); break;
				case 'ROTF': this.BG_rotation[GameData.BG_FULLSCREEN] = this.parseFloat(buffer, block); break;
				case 'LAYF': this.BG_layback[GameData.BG_FULLSCREEN] = this.parseFloat(buffer, block); break;
				case 'INCF': this.BG_inclination[GameData.BG_FULLSCREEN] = this.parseFloat(buffer, block); break;
				case 'FOVF': this.BG_FOV[GameData.BG_FULLSCREEN] = this.parseFloat(buffer, block); break;
				case 'SCFX': this.BG_scalex[GameData.BG_FULLSCREEN] = this.parseFloat(buffer, block); break;
				case 'SCFY': this.BG_scaley[GameData.BG_FULLSCREEN] = this.parseFloat(buffer, block); break;
				case 'SCFZ': this.BG_scalez[GameData.BG_FULLSCREEN] = this.parseFloat(buffer, block); break;
				case 'XLFX': this.BG_xlatex[GameData.BG_FULLSCREEN] = this.parseFloat(buffer, block); break;
				case 'XLFY': this.BG_xlatey[GameData.BG_FULLSCREEN] = this.parseFloat(buffer, block); break;
				case 'XLFZ': this.BG_xlatez[GameData.BG_FULLSCREEN] = this.parseFloat(buffer, block); break;
				case 'ROFS': this.BG_rotation[GameData.BG_FSS] = this.parseFloat(buffer, block); break;
				case 'LAFS': this.BG_layback[GameData.BG_FSS] = this.parseFloat(buffer, block); break;
				case 'INFS': this.BG_inclination[GameData.BG_FSS] = this.parseFloat(buffer, block); break;
				case 'FOFS': this.BG_FOV[GameData.BG_FSS] = this.parseFloat(buffer, block); break;
				case 'SCXS': this.BG_scalex[GameData.BG_FSS] = this.parseFloat(buffer, block); break;
				case 'SCYS': this.BG_scaley[GameData.BG_FSS] = this.parseFloat(buffer, block); break;
				case 'SCZS': this.BG_scalez[GameData.BG_FSS] = this.parseFloat(buffer, block); break;
				case 'XLXS': this.BG_xlatex[GameData.BG_FSS] = this.parseFloat(buffer, block); break;
				case 'XLYS': this.BG_xlatey[GameData.BG_FSS] = this.parseFloat(buffer, block); break;
				case 'XLZS': this.BG_xlatez[GameData.BG_FSS] = this.parseFloat(buffer, block); break;
				case 'EFSS':
					this.BG_enable_FSS = this.parseBool(buffer, block);
					if (this.BG_enable_FSS) {
						this.BG_current_set = GameData.BG_FSS;
					}
					break;
				case 'ORRP': this.overridePhysics = this.parseInt(buffer, block); break;
				case 'ORPF': this.overridePhysicsFlipper = this.parseBool(buffer, block); break;
				case 'GAVT': this.Gravity = this.parseFloat(buffer, block); break;
				case 'FRCT': this.friction = this.parseFloat(buffer, block); break;
				case 'ELAS': this.elasticity = this.parseFloat(buffer, block); break;
				case 'ELFA': this.elasticityFalloff = this.parseFloat(buffer, block); break;
				case 'PFSC': this.scatter = this.parseFloat(buffer, block); break;
				case 'SCAT': this.defaultScatter = this.parseFloat(buffer, block); break;
				case 'NDGT': this.nudgeTime = this.parseFloat(buffer, block); break;
				case 'MPGC': this.plungerNormalize = this.parseInt(buffer, block); break;
				case 'MPDF': this.plungerFilter = this.parseBool(buffer, block); break;
				case 'PHML': this.PhysicsMaxLoops = this.parseInt(buffer, block); break;
				case 'DECL': this.fRenderDecals = this.parseBool(buffer, block); break;
				case 'REEL': this.fRenderEMReels = this.parseBool(buffer, block); break;
				case 'OFFX': this.offset.x = this.parseFloat(buffer, block); break;
				case 'OFFY': this.offset.y = this.parseFloat(buffer, block); break;
				case 'ZOOM': this.zoom = this.parseFloat(buffer, block); break;
				case 'MAXSEP': this._3DmaxSeparation = this.parseFloat(buffer, block); break;
				case 'ZPD': this._3DZPD = this.parseFloat(buffer, block); break;
				case 'STO': this._3DOffset = this.parseFloat(buffer, block); break;
				case 'OGST': this.overwriteGlobalStereo3D = this.parseBool(buffer, block); break;
				case 'SLPX': this.angletiltMax = this.parseFloat(buffer, block); break;
				case 'SLOP': this.angletiltMin = this.parseFloat(buffer, block); break;
				case 'GLAS': this.glassheight = this.parseFloat(buffer, block); break;
				case 'TBLH': this.tableheight = this.parseFloat(buffer, block); break;
				case 'IMAG': this.szImage = this.parseString(buffer, block, 4); break;
				case 'BLIM': this.szBallImage = this.parseString(buffer, block, 4); break;
				case 'BLIF': this.szBallImageFront = this.parseString(buffer, block, 4); break;
				case 'SSHT': this.szScreenShot = this.parseString(buffer, block, 4); break;
				case 'FBCK': this.fBackdrop = this.parseBool(buffer, block); break;
				case 'SEDT': this.numGameItems = this.parseInt(buffer, block); break;
				case 'SSND': this.numSounds = this.parseInt(buffer, block); break;
				case 'SIMG': this.numTextures = this.parseInt(buffer, block); break;
				case 'SFNT': this.numFonts = this.parseInt(buffer, block); break;
				case 'SCOL': this.numCollections = this.parseInt(buffer, block); break;
				case 'CODE': this.script = this.parseString(buffer, block); break;
				case 'NAME': this.wzName = this.parseWideString(buffer, block); break;
				case 'BIMG': this.BG_szImage[GameData.BG_DESKTOP] = this.parseString(buffer, block, 4); break;
				case 'BIMF': this.BG_szImage[GameData.BG_FULLSCREEN] = this.parseString(buffer, block, 4); break;
				case 'BIMS': this.BG_szImage[GameData.BG_FSS] = this.parseString(buffer, block, 4); break;
				case 'BIMN': this.ImageBackdropNightDay = this.parseBool(buffer, block); break;
				case 'IMCG': this.szImageColorGrade = this.parseString(buffer, block, 4); break;
				case 'EIMG': this.szEnvImage = this.parseString(buffer, block, 4); break;
				case 'PLMA': this.szPlayfieldMaterial = this.parseString(buffer, block, 4); break;
				case 'LZAM': this.lightAmbient = this.parseInt(buffer, block); break;
				case 'LZDI': this.Light[0].emission = this.parseInt(buffer, block); break;
				case 'LZHI': this.lightHeight = this.parseFloat(buffer, block); break;
				case 'LZRA': this.lightRange = this.parseFloat(buffer, block); break;
				case 'LIES': this.lightEmissionScale = this.parseFloat(buffer, block); break;
				case 'ENES': this.envEmissionScale = this.parseFloat(buffer, block); break;
				case 'GLES': this.globalEmissionScale = this.parseFloat(buffer, block); break;
				case 'AOSC': this.AOScale = this.parseFloat(buffer, block); break;
				case 'SSSC': this.SSRScale = this.parseFloat(buffer, block); break;
				case 'BREF': this.useReflectionForBalls = this.parseInt(buffer, block); break;
				case 'PLST': this.playfieldReflectionStrength = this.parseInt(buffer, block); break; // m_playfieldReflectionStrength = dequantizeUnsigned<8>(tmp);
				case 'BTRA': this.useTrailForBalls = this.parseInt(buffer, block); break;
				case 'BTST': this.ballTrailStrength = this.parseInt(buffer, block); break; // m_ballTrailStrength = dequantizeUnsigned<8>(tmp);
				case 'BPRS': this.ballPlayfieldReflectionStrength = this.parseFloat(buffer, block); break;
				case 'DBIS': this.defaultBulbIntensityScaleOnBall = this.parseFloat(buffer, block); break;
				case 'UAAL': this.useAA = this.parseInt(buffer, block); break;
				case 'UAOC': this.useAO = this.parseInt(buffer, block); break;
				case 'USSR': this.useSSR = this.parseInt(buffer, block); break;
				case 'UFXA': this.useFXAA = this.parseFloat(buffer, block); break;
				case 'BLST': this.bloom_strength = this.parseFloat(buffer, block); break;
				case 'BCLR': this.colorbackdrop = this.parseInt(buffer, block); break;
				case 'CCUS': this.rgcolorcustom = this.parseUnsignedInt4s(buffer, block, 16); break;
				case 'TDFT': this.globalDifficulty = this.parseFloat(buffer, block); break;
				case 'CUST': this.szT = this.parseString(buffer, block, 4); this.vCustomInfoTag.push(this.szT); break;
				case 'SVOL': this.TableSoundVolume = this.parseFloat(buffer, block); break;
				case 'BDMO': this.BallDecalMode = this.parseBool(buffer, block); break;
				case 'MVOL': this.TableMusicVolume = this.parseFloat(buffer, block); break;
				case 'AVSY': this.TableAdaptiveVSync = this.parseInt(buffer, block); break;
				case 'OGAC': this.overwriteGlobalDetailLevel = this.parseBool(buffer, block); break;
				case 'OGDN': this.overwriteGlobalDayNight = this.parseBool(buffer, block); break;
				case 'GDAC': this.fGrid = this.parseBool(buffer, block); break;
				case 'REOP': this.fReflectElementsOnPlayfield = this.parseBool(buffer, block); break;
				case 'ARAC': this.userDetailLevel = this.parseInt(buffer, block); break;
				case 'MASI': this.numMaterials = this.parseInt(buffer, block); break;
				case 'MATE': this.materials = this._parseMaterials(buffer, block, this.numMaterials); break;
				case 'PHMA': this._parsePhysicsMaterials(buffer, block, this.numMaterials); break;
			}
		}
	}

	private _parseMaterials(buffer: Buffer, block: BiffBlock, num: number): Material[] {
		if (block.len < num * SaveMaterial.size) {
			throw new Error('Cannot parse ' + num + ' materials of ' + (num * SaveMaterial.size) + ' bytes from a ' + buffer.length + ' bytes buffer.');
		}
		const materials: Material[] = [];
		for (let i = 0; i < num; i++) {
			const saveMat = new SaveMaterial(buffer, block, i);
			materials.push(Material.fromSaved(saveMat));
		}
		return materials;
	}

	private _parsePhysicsMaterials(buffer: Buffer, block: BiffBlock, num: number): void {
		if (block.len < num * SavePhysicsMaterial.size) {
			throw new Error('Cannot parse ' + num + ' physical materials of ' + (num * SavePhysicsMaterial.size) + ' bytes from a ' + buffer.length + ' bytes buffer.');
		}
		for (let i = 0; i < num; i++) {
			const savePhysMat = new SavePhysicsMaterial(buffer, block, i);
			const material = this.materials.find(m => m.szName === savePhysMat.szName);
			if (!material) {
				throw new Error('Cannot find material "' + savePhysMat.szName + '" in [' + this.materials.map(m => m.szName).join(', ') + '] for updating physics.');
			}
			material.physUpdate(savePhysMat);
		}
	}
}

class LightSource {

	public static load(buffer: Buffer, block: BiffBlock) {
		const v2 = new Vertex2D();
		v2.x = buffer.readFloatLE(block.pos);
		v2.y = buffer.readFloatLE(block.pos + 4);
		return v2;
	}

	public static from(data: any): Vertex2D {
		return Object.assign(new Vertex2D(), data);
	}

	public emission: number;
	public pos: Vertex3D;
}

class SaveMaterial {

	public static size = 76;

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

	constructor(buffer: Buffer, block: BiffBlock, i = 0) {
		const offset = block.pos + i * SaveMaterial.size;
		this.szName = BiffParser.parseNullTerminatedString(buffer.slice(offset, offset + 32));
		this.cBase = buffer.readInt32LE(offset + 32);
		this.cGlossy = buffer.readInt32LE(offset + 36);
		this.cClearcoat = buffer.readInt32LE(offset + 40);
		this.fWrapLighting = buffer.readFloatLE(offset + 44);
		this.bIsMetal =  buffer.readInt32LE(offset + 48) > 0;
		this.fRoughness =  buffer.readFloatLE(offset + 52);
		this.fGlossyImageLerp =  buffer.readInt32LE(offset + 56);
		this.fEdge =  buffer.readFloatLE(offset + 60);
		this.fThickness =  buffer.readInt32LE(offset + 64);
		this.fOpacity =  buffer.readFloatLE(offset + 68);
		this.bOpacityActive_fEdgeAlpha =  buffer.readInt32LE(offset + 72);
	}
}

class SavePhysicsMaterial {

	public static size = 48;

	public szName: string;
	public fElasticity: number;
	public fElasticityFallOff: number;
	public fFriction: number;
	public fScatterAngle: number;

	constructor(buffer: Buffer, block: BiffBlock, i = 0) {
		const offset = block.pos + i * SavePhysicsMaterial.size;
		this.szName = BiffParser.parseNullTerminatedString(buffer.slice(offset, offset + 32));
		this.fElasticity =  buffer.readFloatLE(offset + 32);
		this.fElasticityFallOff =  buffer.readFloatLE(offset + 36);
		this.fFriction =  buffer.readFloatLE(offset + 40);
		this.fScatterAngle =  buffer.readFloatLE(offset + 44);
	}
}

class Material {

	public static fromSaved(saveMaterial: SaveMaterial): Material {
		const material = new Material();
		material.szName = saveMaterial.szName;
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
		// tslint:disable-next-line:no-bitwise
		material.bOpacityActive = !!(saveMaterial.bOpacityActive_fEdgeAlpha & 1);
		material.fEdgeAlpha = 0; //dequantizeUnsigned<7>(mats[i].bOpacityActive_fEdgeAlpha >> 1);
		return material;
	}

	public static fromCached(data: any): Material {
		const material = new Material();
		Object.assign(material, data);
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

	public serialize() {
		return {
			name: this.szName,
			wrap_lighting: this.fWrapLighting,
			roughness: this.fRoughness,
			//glossy_image_lerp: this.fGlossyImageLerp,
			//thickness: this.fThickness,
			edge: this.fEdge,
			//edge_alpha: this.fEdgeAlpha,
			opacity: this.fOpacity,
			base_color: this.cBase,
			glossy_color: this.cGlossy,
			clearcoat_color: this.cClearcoat,
			is_metal: this.bIsMetal,
			is_opacity_enabled: this.bOpacityActive,
		};
	}

	public physUpdate(savePhysMat: SavePhysicsMaterial) {
		this.fElasticity = savePhysMat.fElasticity;
		this.fElasticityFalloff = savePhysMat.fElasticityFallOff;
		this.fFriction = savePhysMat.fFriction;
		this.fScatterAngle = savePhysMat.fScatterAngle;
	}
}
