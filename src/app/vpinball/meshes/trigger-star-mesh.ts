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

import { Mesh } from '../mesh';

const vertices = [
	[0.000000, 0.002343, 0.291799, 0.000000, 0.000000, 1.000000, 0.500000, 0.430000],
	[0.179117, -0.055860, 0.291800, 0.061500, -0.020000, 0.997900, 0.524350, 0.504941],
	[0.179117, 0.060547, 0.291799, 0.061500, 0.020000, 0.997900, 0.475650, 0.504941],
	[0.467958, -0.043648, 0.255800, 0.179400, 0.000000, 0.983800, 0.519241, 0.625788],
	[0.467958, 0.048334, 0.255799, 0.179400, 0.000000, 0.983800, 0.480759, 0.625788],
	[0.179117, 0.060546, -0.036547, 0.951100, 0.309000, 0.000200, 0.185085, 0.998195],
	[0.179117, 0.060547, 0.291799, 0.951100, 0.309000, -0.000000, 0.185085, 0.867195],
	[0.467958, 0.048334, 0.255799, 0.042900, 0.999100, -0.000600, 0.295842, 0.875267],
	[0.179117, -0.055860, 0.291800, 0.951100, -0.309000, 0.000000, 0.814285, 0.867195],
	[0.179117, -0.055861, -0.036547, 0.951100, -0.309000, 0.000200, 0.814285, 0.998195],
	[0.467958, -0.043648, 0.255800, 0.042900, -0.999100, -0.000600, 0.702373, 0.875267],
	[0.968000, -0.022493, 0.104600, 0.042100, -0.999100, 0.001000, 0.509685, 0.901977],
	[0.791931, -0.029583, 0.176600, 0.041900, -0.999100, 0.002600, 0.578849, 0.888510],
	[0.791931, 0.034269, 0.176599, 0.307100, 0.000000, 0.951700, 0.486643, 0.761335],
	[0.791931, -0.029583, 0.176600, 0.307100, 0.000000, 0.951700, 0.513357, 0.761335],
	[0.791931, 0.034269, 0.176599, 0.041900, 0.999100, 0.002600, 0.420115, 0.888510],
	[0.968000, 0.027179, 0.104599, 0.378500, 0.000000, 0.925600, 0.489610, 0.835000],
	[0.968000, -0.022493, 0.104600, 0.378500, 0.000000, 0.925600, 0.510390, 0.835000],
	[0.968000, 0.027179, 0.104599, 0.042100, 0.999100, 0.001000, 0.489685, 0.901977],
	[0.968000, 0.027179, 0.104599, 1.000000, -0.000000, -0.000000, 0.489685, 0.901977],
	[0.968000, -0.022493, 0.104600, 1.000000, -0.000000, -0.000000, 0.509685, 0.901977],
	[0.968000, 0.027178, -0.036547, 1.000000, -0.000000, -0.000000, 0.489685, 0.998195],
	[0.968000, -0.022494, -0.036547, 1.000000, -0.000000, -0.000000, 0.509685, 0.998195],
	[0.968000, -0.022494, -0.036547, 0.042300, -0.999100, 0.000000, 0.509685, 0.998195],
	[0.968000, 0.027178, -0.036547, 0.042300, 0.999100, -0.000000, 0.489685, 0.998195],
	[0.110700, -0.150035, 0.291800, 0.038000, -0.052300, 0.997900, 0.563748, 0.476316],
	[0.351555, -0.309946, 0.255800, 0.145100, -0.105400, 0.983800, 0.630647, 0.577087],
	[0.405617, -0.235531, 0.255800, 0.145100, -0.105400, 0.983800, 0.599516, 0.599705],
	[0.179117, -0.055861, -0.036547, 0.951100, -0.309000, 0.000200, 0.185085, 0.998195],
	[0.179117, -0.055860, 0.291800, 0.951100, -0.309000, 0.000000, 0.185085, 0.867195],
	[0.405617, -0.235531, 0.255800, 0.622000, 0.783000, -0.000600, 0.295842, 0.875267],
	[0.110700, -0.150035, 0.291800, 0.587800, -0.809000, 0.000000, 0.814285, 0.867195],
	[0.110700, -0.150036, -0.036547, 0.587800, -0.809000, 0.000200, 0.814285, 0.998195],
	[0.351555, -0.309946, 0.255800, -0.552600, -0.833500, -0.000600, 0.702373, 0.875267],
	[0.768531, -0.586773, 0.104601, -0.553300, -0.833000, 0.001000, 0.509685, 0.901977],
	[0.621922, -0.489010, 0.176600, -0.553400, -0.832900, 0.002600, 0.578849, 0.888510],
	[0.659450, -0.437352, 0.176600, 0.248400, -0.180500, 0.951700, 0.683948, 0.705906],
	[0.621922, -0.489010, 0.176600, 0.248400, -0.180500, 0.951700, 0.705559, 0.690205],
	[0.659450, -0.437352, 0.176600, 0.621200, 0.783600, 0.002600, 0.420115, 0.888510],
	[0.797726, -0.546587, 0.104601, 0.306200, -0.222500, 0.925600, 0.729647, 0.763759],
	[0.768531, -0.586773, 0.104601, 0.306200, -0.222500, 0.925600, 0.746459, 0.751545],
	[0.797726, -0.546587, 0.104601, 0.621300, 0.783500, 0.001000, 0.489685, 0.901977],
	[0.797726, -0.546587, 0.104601, 0.809000, -0.587800, 0.000000, 0.489685, 0.901977],
	[0.768531, -0.586773, 0.104601, 0.809000, -0.587800, 0.000000, 0.509685, 0.901977],
	[0.797726, -0.546588, -0.036546, 0.809000, -0.587800, 0.000000, 0.489685, 0.998195],
	[0.768531, -0.586774, -0.036546, 0.809000, -0.587800, 0.000000, 0.509685, 0.998195],
	[0.768531, -0.586774, -0.036546, -0.553100, -0.833100, 0.000000, 0.509685, 0.998195],
	[0.797726, -0.546588, -0.036546, 0.621500, 0.783400, -0.000000, 0.489685, 0.998195],
	[-0.000000, -0.186007, 0.291800, 0.000000, -0.064700, 0.997900, 0.578797, 0.430000],
	[0.100871, -0.456960, 0.255800, 0.055400, -0.170600, 0.983800, 0.692151, 0.472203],
	[0.188343, -0.428536, 0.255800, 0.055400, -0.170600, 0.983800, 0.680260, 0.508801],
	[0.110700, -0.150036, -0.036547, 0.587800, -0.809000, 0.000200, 0.185085, 0.998195],
	[0.110700, -0.150035, 0.291800, 0.587800, -0.809000, 0.000000, 0.185085, 0.867195],
	[0.188343, -0.428536, 0.255800, 0.963400, 0.267900, -0.000600, 0.295842, 0.875267],
	[-0.000000, -0.186007, 0.291800, 0.000000, -1.000000, 0.000000, 0.814285, 0.867195],
	[-0.000000, -0.186008, -0.036547, -0.000000, -1.000000, 0.000200, 0.814285, 0.998195],
	[0.100871, -0.456960, 0.255800, -0.936900, -0.349500, -0.000600, 0.702373, 0.875267],
	[0.275510, -0.926031, 0.104601, -0.937200, -0.348700, 0.001000, 0.509685, 0.901977],
	[0.214359, -0.760756, 0.176601, -0.937300, -0.348600, 0.002600, 0.578849, 0.888510],
	[0.275081, -0.741025, 0.176601, 0.094900, -0.292000, 0.951700, 0.810991, 0.545091],
	[0.214359, -0.760756, 0.176601, 0.094900, -0.292000, 0.951700, 0.819246, 0.519685],
	[0.275081, -0.741025, 0.176601, 0.963200, 0.268800, 0.002600, 0.420115, 0.888510],
	[0.322747, -0.910681, 0.104601, 0.117000, -0.360000, 0.925600, 0.881967, 0.565034],
	[0.275510, -0.926031, 0.104601, 0.117000, -0.360000, 0.925600, 0.888389, 0.545270],
	[0.322747, -0.910681, 0.104601, 0.963200, 0.268700, 0.001000, 0.489685, 0.901977],
	[0.322747, -0.910681, 0.104601, 0.309000, -0.951000, 0.000000, 0.489685, 0.901977],
	[0.275510, -0.926031, 0.104601, 0.309000, -0.951000, 0.000000, 0.509685, 0.901977],
	[0.322747, -0.910682, -0.036545, 0.309000, -0.951000, 0.000000, 0.489685, 0.998195],
	[0.275510, -0.926031, -0.036545, 0.309000, -0.951000, 0.000000, 0.509685, 0.998195],
	[0.275510, -0.926031, -0.036545, -0.937200, -0.348900, 0.000000, 0.509685, 0.998195],
	[0.322747, -0.910682, -0.036545, 0.963300, 0.268500, -0.000000, 0.489685, 0.998195],
	[-0.110700, -0.150035, 0.291800, -0.038000, -0.052300, 0.997900, 0.563748, 0.383684],
	[-0.188343, -0.428536, 0.255800, -0.055400, -0.170600, 0.983800, 0.680260, 0.351199],
	[-0.100870, -0.456960, 0.255800, -0.055400, -0.170600, 0.983800, 0.692151, 0.387797],
	[-0.000000, -0.186008, -0.036547, -0.000000, -1.000000, 0.000200, 0.185085, 0.998195],
	[-0.000000, -0.186007, 0.291800, 0.000000, -1.000000, 0.000000, 0.185085, 0.867195],
	[-0.100870, -0.456960, 0.255800, 0.936900, -0.349500, -0.000600, 0.295842, 0.875267],
	[-0.110700, -0.150035, 0.291800, -0.587800, -0.809000, 0.000000, 0.814285, 0.867195],
	[-0.110700, -0.150036, -0.036547, -0.587800, -0.809000, 0.000200, 0.814285, 0.998195],
	[-0.188343, -0.428536, 0.255800, -0.963400, 0.267900, -0.000600, 0.702373, 0.875267],
	[-0.322747, -0.910681, 0.104601, -0.963200, 0.268700, 0.001000, 0.509685, 0.901977],
	[-0.275081, -0.741025, 0.176601, -0.963200, 0.268800, 0.002600, 0.578849, 0.888510],
	[-0.214359, -0.760756, 0.176601, -0.094900, -0.292000, 0.951700, 0.819246, 0.340315],
	[-0.275081, -0.741025, 0.176601, -0.094900, -0.292000, 0.951700, 0.810991, 0.314909],
	[-0.214359, -0.760756, 0.176601, 0.937300, -0.348600, 0.002600, 0.420115, 0.888510],
	[-0.275510, -0.926031, 0.104601, -0.117000, -0.360000, 0.925600, 0.888389, 0.314730],
	[-0.322747, -0.910681, 0.104601, -0.117000, -0.360000, 0.925600, 0.881967, 0.294966],
	[-0.275510, -0.926031, 0.104601, 0.937200, -0.348700, 0.001000, 0.489685, 0.901977],
	[-0.275510, -0.926031, 0.104601, -0.309000, -0.951000, 0.000000, 0.489685, 0.901977],
	[-0.322747, -0.910681, 0.104601, -0.309000, -0.951000, 0.000000, 0.509685, 0.901977],
	[-0.275510, -0.926031, -0.036545, -0.309000, -0.951000, 0.000000, 0.489685, 0.998195],
	[-0.322747, -0.910682, -0.036545, -0.309000, -0.951000, 0.000000, 0.509685, 0.998195],
	[-0.322747, -0.910682, -0.036545, -0.963300, 0.268500, -0.000000, 0.509685, 0.998195],
	[-0.275510, -0.926031, -0.036545, 0.937200, -0.348900, 0.000000, 0.489685, 0.998195],
	[-0.179117, -0.055860, 0.291800, -0.061500, -0.020000, 0.997900, 0.524350, 0.355060],
	[-0.405617, -0.235531, 0.255800, -0.145100, -0.105400, 0.983800, 0.599516, 0.260295],
	[-0.351555, -0.309946, 0.255800, -0.145100, -0.105400, 0.983800, 0.630647, 0.282913],
	[-0.110700, -0.150036, -0.036547, -0.587800, -0.809000, 0.000200, 0.185085, 0.998195],
	[-0.110700, -0.150035, 0.291800, -0.587800, -0.809000, 0.000000, 0.185085, 0.867195],
	[-0.351555, -0.309946, 0.255800, 0.552600, -0.833500, -0.000600, 0.295842, 0.875267],
	[-0.179117, -0.055860, 0.291800, -0.951100, -0.309000, 0.000000, 0.814285, 0.867195],
	[-0.179117, -0.055861, -0.036547, -0.951100, -0.309000, 0.000200, 0.814285, 0.998195],
	[-0.405617, -0.235531, 0.255800, -0.622000, 0.783000, -0.000600, 0.702373, 0.875267],
	[-0.797725, -0.546587, 0.104601, -0.621300, 0.783500, 0.001000, 0.509685, 0.901977],
	[-0.659450, -0.437352, 0.176600, -0.621200, 0.783600, 0.002600, 0.578849, 0.888510],
	[-0.621922, -0.489010, 0.176600, -0.248400, -0.180500, 0.951700, 0.705559, 0.169795],
	[-0.659450, -0.437352, 0.176600, -0.248400, -0.180500, 0.951700, 0.683948, 0.154094],
	[-0.621922, -0.489010, 0.176600, 0.553400, -0.832900, 0.002600, 0.420115, 0.888510],
	[-0.768531, -0.586773, 0.104601, -0.306200, -0.222500, 0.925600, 0.746459, 0.108456],
	[-0.797725, -0.546587, 0.104601, -0.306200, -0.222500, 0.925600, 0.729647, 0.096241],
	[-0.768531, -0.586773, 0.104601, 0.553300, -0.833000, 0.001000, 0.489685, 0.901977],
	[-0.768531, -0.586773, 0.104601, -0.809000, -0.587700, 0.000000, 0.489685, 0.901977],
	[-0.797725, -0.546587, 0.104601, -0.809000, -0.587700, 0.000000, 0.509685, 0.901977],
	[-0.768531, -0.586774, -0.036546, -0.809000, -0.587800, 0.000000, 0.489685, 0.998195],
	[-0.797725, -0.546588, -0.036546, -0.809000, -0.587800, 0.000000, 0.509685, 0.998195],
	[-0.797725, -0.546588, -0.036546, -0.621500, 0.783400, -0.000000, 0.509685, 0.998195],
	[-0.768531, -0.586774, -0.036546, 0.553100, -0.833100, 0.000000, 0.489685, 0.998195],
	[-0.179117, 0.060547, 0.291799, -0.061500, 0.020000, 0.997900, 0.475650, 0.355060],
	[-0.467958, 0.048334, 0.255799, -0.179400, 0.000000, 0.983800, 0.480760, 0.234212],
	[-0.467958, -0.043648, 0.255800, -0.179400, 0.000000, 0.983800, 0.519241, 0.234212],
	[-0.179117, -0.055861, -0.036547, -0.951100, -0.309000, 0.000200, 0.185085, 0.998195],
	[-0.179117, -0.055860, 0.291800, -0.951100, -0.309000, 0.000000, 0.185085, 0.867195],
	[-0.467958, -0.043648, 0.255800, -0.042900, -0.999100, -0.000600, 0.295842, 0.875267],
	[-0.179117, 0.060547, 0.291799, -0.951100, 0.309000, -0.000000, 0.814285, 0.867195],
	[-0.179117, 0.060546, -0.036547, -0.951100, 0.309000, 0.000200, 0.814285, 0.998195],
	[-0.467958, 0.048334, 0.255799, -0.042900, 0.999100, -0.000600, 0.702373, 0.875267],
	[-0.968000, 0.027179, 0.104599, -0.042100, 0.999100, 0.001000, 0.509685, 0.901977],
	[-0.791931, 0.034269, 0.176599, -0.041900, 0.999100, 0.002600, 0.578849, 0.888510],
	[-0.791931, -0.029583, 0.176600, -0.307100, 0.000000, 0.951700, 0.513357, 0.098665],
	[-0.791931, 0.034269, 0.176599, -0.307100, 0.000000, 0.951700, 0.486643, 0.098665],
	[-0.791931, -0.029583, 0.176600, -0.041900, -0.999100, 0.002600, 0.420115, 0.888510],
	[-0.968000, -0.022493, 0.104600, -0.378500, 0.000000, 0.925600, 0.510390, 0.025000],
	[-0.968000, 0.027179, 0.104599, -0.378500, 0.000000, 0.925600, 0.489610, 0.025000],
	[-0.968000, -0.022493, 0.104600, -0.042100, -0.999100, 0.001000, 0.489685, 0.901977],
	[-0.968000, -0.022493, 0.104600, -1.000000, -0.000000, -0.000000, 0.489685, 0.901977],
	[-0.968000, 0.027179, 0.104599, -1.000000, -0.000000, -0.000000, 0.509685, 0.901977],
	[-0.968000, -0.022494, -0.036547, -1.000000, -0.000000, -0.000000, 0.489685, 0.998195],
	[-0.968000, 0.027178, -0.036547, -1.000000, -0.000000, -0.000000, 0.509685, 0.998195],
	[-0.968000, 0.027178, -0.036547, -0.042300, 0.999100, -0.000000, 0.509685, 0.998195],
	[-0.968000, -0.022494, -0.036547, -0.042300, -0.999100, 0.000000, 0.489685, 0.998195],
	[-0.110700, 0.154722, 0.291799, -0.038000, 0.052300, 0.997900, 0.436252, 0.383684],
	[-0.351555, 0.314633, 0.255799, -0.145100, 0.105400, 0.983800, 0.369353, 0.282913],
	[-0.405617, 0.240217, 0.255799, -0.145100, 0.105400, 0.983800, 0.400485, 0.260295],
	[-0.179117, 0.060546, -0.036547, -0.951100, 0.309000, 0.000200, 0.185085, 0.998195],
	[-0.179117, 0.060547, 0.291799, -0.951100, 0.309000, -0.000000, 0.185085, 0.867195],
	[-0.405617, 0.240217, 0.255799, -0.622000, -0.783000, -0.000600, 0.295842, 0.875267],
	[-0.110700, 0.154722, 0.291799, -0.587800, 0.809000, -0.000000, 0.814285, 0.867195],
	[-0.110700, 0.154721, -0.036547, -0.587800, 0.809000, 0.000200, 0.814285, 0.998195],
	[-0.351555, 0.314633, 0.255799, 0.552600, 0.833500, -0.000600, 0.702373, 0.875267],
	[-0.768531, 0.591459, 0.104598, 0.553300, 0.833000, 0.001000, 0.509685, 0.901977],
	[-0.621922, 0.493696, 0.176599, 0.553400, 0.832900, 0.002600, 0.578849, 0.888510],
	[-0.659450, 0.442038, 0.176599, -0.248400, 0.180500, 0.951700, 0.316052, 0.154094],
	[-0.621922, 0.493696, 0.176599, -0.248400, 0.180500, 0.951700, 0.294441, 0.169795],
	[-0.659450, 0.442038, 0.176599, -0.621200, -0.783600, 0.002600, 0.420115, 0.888510],
	[-0.797726, 0.551273, 0.104598, -0.306200, 0.222500, 0.925600, 0.270353, 0.096241],
	[-0.768531, 0.591459, 0.104598, -0.306200, 0.222500, 0.925600, 0.253541, 0.108456],
	[-0.797726, 0.551273, 0.104598, -0.621300, -0.783500, 0.001000, 0.489685, 0.901977],
	[-0.797726, 0.551273, 0.104598, -0.809000, 0.587800, -0.000000, 0.489685, 0.901977],
	[-0.768531, 0.591459, 0.104598, -0.809000, 0.587800, -0.000000, 0.509685, 0.901977],
	[-0.797726, 0.551273, -0.036548, -0.809000, 0.587800, -0.000000, 0.489685, 0.998195],
	[-0.768531, 0.591458, -0.036548, -0.809000, 0.587800, -0.000000, 0.509685, 0.998195],
	[-0.768531, 0.591458, -0.036548, 0.553100, 0.833100, -0.000000, 0.509685, 0.998195],
	[-0.797726, 0.551273, -0.036548, -0.621500, -0.783400, 0.000000, 0.489685, 0.998195],
	[0.000000, 0.190694, 0.291799, -0.000000, 0.064700, 0.997900, 0.421203, 0.430000],
	[-0.100871, 0.461647, 0.255799, -0.055400, 0.170600, 0.983800, 0.307849, 0.387797],
	[-0.188344, 0.433223, 0.255799, -0.055400, 0.170600, 0.983800, 0.319740, 0.351199],
	[-0.110700, 0.154721, -0.036547, -0.587800, 0.809000, 0.000200, 0.185085, 0.998195],
	[-0.110700, 0.154722, 0.291799, -0.587800, 0.809000, -0.000000, 0.185085, 0.867195],
	[-0.188344, 0.433223, 0.255799, -0.963400, -0.267900, -0.000600, 0.295842, 0.875267],
	[0.000000, 0.190694, 0.291799, -0.000000, 1.000000, -0.000000, 0.814285, 0.867195],
	[0.000000, 0.190693, -0.036547, -0.000000, 1.000000, 0.000200, 0.814285, 0.998195],
	[-0.100871, 0.461647, 0.255799, 0.936900, 0.349500, -0.000600, 0.702373, 0.875267],
	[-0.275510, 0.930717, 0.104598, 0.937200, 0.348700, 0.001000, 0.509685, 0.901977],
	[-0.214359, 0.765443, 0.176598, 0.937300, 0.348600, 0.002600, 0.578849, 0.888510],
	[-0.275081, 0.745711, 0.176598, -0.094900, 0.292000, 0.951700, 0.189009, 0.314909],
	[-0.214359, 0.765443, 0.176598, -0.094900, 0.292000, 0.951700, 0.180755, 0.340315],
	[-0.275081, 0.745711, 0.176598, -0.963200, -0.268800, 0.002600, 0.420115, 0.888510],
	[-0.322747, 0.915367, 0.104598, -0.117000, 0.360000, 0.925600, 0.118033, 0.294966],
	[-0.275510, 0.930717, 0.104598, -0.117000, 0.360000, 0.925600, 0.111611, 0.314730],
	[-0.322747, 0.915367, 0.104598, -0.963200, -0.268700, 0.001000, 0.489685, 0.901977],
	[-0.322747, 0.915367, 0.104598, -0.309000, 0.951000, -0.000000, 0.489685, 0.901977],
	[-0.275510, 0.930717, 0.104598, -0.309000, 0.951000, -0.000000, 0.509685, 0.901977],
	[-0.322747, 0.915366, -0.036549, -0.309000, 0.951000, -0.000000, 0.489685, 0.998195],
	[-0.275510, 0.930716, -0.036549, -0.309000, 0.951100, -0.000000, 0.509685, 0.998195],
	[-0.275510, 0.930716, -0.036549, 0.937200, 0.348900, -0.000000, 0.509685, 0.998195],
	[-0.322747, 0.915366, -0.036549, -0.963300, -0.268500, 0.000000, 0.489685, 0.998195],
	[0.110700, 0.154722, 0.291799, 0.038000, 0.052300, 0.997900, 0.436252, 0.476316],
	[0.188343, 0.433223, 0.255799, 0.055400, 0.170600, 0.983800, 0.319740, 0.508801],
	[0.100870, 0.461647, 0.255799, 0.055400, 0.170600, 0.983800, 0.307849, 0.472203],
	[0.000000, 0.190693, -0.036547, -0.000000, 1.000000, 0.000200, 0.185085, 0.998195],
	[0.000000, 0.190694, 0.291799, -0.000000, 1.000000, -0.000000, 0.185085, 0.867195],
	[0.100870, 0.461647, 0.255799, -0.936900, 0.349500, -0.000600, 0.295842, 0.875267],
	[0.110700, 0.154722, 0.291799, 0.587800, 0.809000, -0.000000, 0.814285, 0.867195],
	[0.110700, 0.154721, -0.036547, 0.587800, 0.809000, 0.000200, 0.814285, 0.998195],
	[0.188343, 0.433223, 0.255799, 0.963400, -0.267900, -0.000600, 0.702373, 0.875267],
	[0.322747, 0.915367, 0.104598, 0.963200, -0.268700, 0.001000, 0.509685, 0.901977],
	[0.275081, 0.745711, 0.176598, 0.963200, -0.268800, 0.002600, 0.578849, 0.888510],
	[0.214359, 0.765443, 0.176598, 0.094900, 0.292000, 0.951700, 0.180755, 0.519685],
	[0.275081, 0.745711, 0.176598, 0.094900, 0.292000, 0.951700, 0.189009, 0.545091],
	[0.214359, 0.765443, 0.176598, -0.937300, 0.348600, 0.002600, 0.420115, 0.888510],
	[0.275510, 0.930717, 0.104598, 0.117000, 0.360000, 0.925600, 0.111611, 0.545270],
	[0.322747, 0.915367, 0.104598, 0.117000, 0.360000, 0.925600, 0.118033, 0.565034],
	[0.275510, 0.930717, 0.104598, -0.937200, 0.348700, 0.001000, 0.489685, 0.901977],
	[0.275510, 0.930717, 0.104598, 0.309000, 0.951000, -0.000000, 0.489685, 0.901977],
	[0.322747, 0.915367, 0.104598, 0.309000, 0.951000, -0.000000, 0.509685, 0.901977],
	[0.275510, 0.930716, -0.036549, 0.309000, 0.951000, -0.000000, 0.489685, 0.998195],
	[0.322747, 0.915366, -0.036549, 0.309000, 0.951000, -0.000000, 0.509685, 0.998195],
	[0.322747, 0.915366, -0.036549, 0.963300, -0.268500, 0.000000, 0.509685, 0.998195],
	[0.275510, 0.930716, -0.036549, -0.937200, 0.348900, -0.000000, 0.489685, 0.998195],
	[0.405617, 0.240217, 0.255799, 0.145100, 0.105400, 0.983800, 0.400485, 0.599705],
	[0.351555, 0.314633, 0.255799, 0.145100, 0.105400, 0.983800, 0.369353, 0.577087],
	[0.110700, 0.154721, -0.036547, 0.587800, 0.809000, 0.000200, 0.185085, 0.998195],
	[0.110700, 0.154722, 0.291799, 0.587800, 0.809000, -0.000000, 0.185085, 0.867195],
	[0.351555, 0.314633, 0.255799, -0.552600, 0.833500, -0.000600, 0.295842, 0.875267],
	[0.179117, 0.060547, 0.291799, 0.951100, 0.309000, -0.000000, 0.814285, 0.867195],
	[0.179117, 0.060546, -0.036547, 0.951100, 0.309000, 0.000200, 0.814285, 0.998195],
	[0.405617, 0.240217, 0.255799, 0.622000, -0.783000, -0.000600, 0.702373, 0.875267],
	[0.797726, 0.551273, 0.104598, 0.621300, -0.783500, 0.001000, 0.509685, 0.901977],
	[0.659450, 0.442038, 0.176599, 0.621200, -0.783600, 0.002600, 0.578849, 0.888510],
	[0.621922, 0.493696, 0.176599, 0.248400, 0.180500, 0.951700, 0.294441, 0.690205],
	[0.659450, 0.442038, 0.176599, 0.248400, 0.180500, 0.951700, 0.316052, 0.705906],
	[0.621922, 0.493696, 0.176599, -0.553400, 0.832900, 0.002600, 0.420115, 0.888510],
	[0.768531, 0.591459, 0.104598, 0.306200, 0.222500, 0.925600, 0.253541, 0.751545],
	[0.797726, 0.551273, 0.104598, 0.306200, 0.222500, 0.925600, 0.270353, 0.763759],
	[0.768531, 0.591459, 0.104598, -0.553300, 0.833000, 0.001000, 0.489685, 0.901977],
	[0.768531, 0.591459, 0.104598, 0.809000, 0.587800, -0.000000, 0.489685, 0.901977],
	[0.797726, 0.551273, 0.104598, 0.809000, 0.587800, -0.000000, 0.509685, 0.901977],
	[0.768531, 0.591459, -0.036548, 0.809000, 0.587800, -0.000000, 0.489685, 0.998195],
	[0.797726, 0.551273, -0.036548, 0.809000, 0.587800, -0.000000, 0.509685, 0.998195],
	[0.797726, 0.551273, -0.036548, 0.621500, -0.783400, 0.000000, 0.509685, 0.998195],
	[0.768531, 0.591459, -0.036548, -0.553100, 0.833100, -0.000000, 0.489685, 0.998195],
];

const indexes = [
	19, 20, 21,
	22, 21, 20,
	0, 1, 2,
	2, 1, 3,
	4, 2, 3,
	3, 14, 4,
	13, 4, 14,
	14, 17, 13,
	16, 13, 17,
	0, 2, 186,
	186, 2, 209,
	210, 186, 209,
	209, 220, 210,
	219, 210, 220,
	220, 223, 219,
	222, 219, 223,
	0, 186, 163,
	163, 186, 187,
	188, 163, 187,
	187, 198, 188,
	197, 188, 198,
	198, 201, 197,
	200, 197, 201,
	0, 163, 140,
	140, 163, 164,
	165, 140, 164,
	164, 175, 165,
	174, 165, 175,
	175, 178, 174,
	177, 174, 178,
	0, 140, 117,
	117, 140, 141,
	142, 117, 141,
	141, 152, 142,
	151, 142, 152,
	152, 155, 151,
	154, 151, 155,
	0, 117, 94,
	94, 117, 118,
	119, 94, 118,
	118, 129, 119,
	128, 119, 129,
	129, 132, 128,
	131, 128, 132,
	0, 94, 71,
	71, 94, 95,
	96, 71, 95,
	95, 106, 96,
	105, 96, 106,
	106, 109, 105,
	108, 105, 109,
	0, 71, 48,
	48, 71, 72,
	73, 48, 72,
	72, 83, 73,
	82, 73, 83,
	83, 86, 82,
	85, 82, 86,
	0, 48, 25,
	0, 25, 1,
	25, 48, 49,
	1, 25, 26,
	50, 25, 49,
	27, 1, 26,
	49, 60, 50,
	26, 37, 27,
	59, 50, 60,
	36, 27, 37,
	60, 63, 59,
	62, 59, 63,
	37, 40, 36,
	39, 36, 40,
	5, 6, 7,
	7, 15, 5,
	15, 18, 5,
	5, 18, 24,
	8, 9, 10,
	12, 10, 9,
	9, 11, 12,
	23, 11, 9,
	28, 29, 30,
	30, 38, 28,
	38, 41, 28,
	28, 41, 47,
	31, 32, 33,
	35, 33, 32,
	32, 34, 35,
	46, 34, 32,
	42, 43, 44,
	45, 44, 43,
	51, 52, 53,
	53, 61, 51,
	61, 64, 51,
	51, 64, 70,
	54, 55, 56,
	58, 56, 55,
	55, 57, 58,
	69, 57, 55,
	65, 66, 67,
	68, 67, 66,
	74, 75, 76,
	76, 84, 74,
	84, 87, 74,
	74, 87, 93,
	77, 78, 79,
	81, 79, 78,
	78, 80, 81,
	92, 80, 78,
	88, 89, 90,
	91, 90, 89,
	97, 98, 99,
	99, 107, 97,
	107, 110, 97,
	97, 110, 116,
	100, 101, 102,
	104, 102, 101,
	101, 103, 104,
	115, 103, 101,
	111, 112, 113,
	114, 113, 112,
	120, 121, 122,
	122, 130, 120,
	130, 133, 120,
	120, 133, 139,
	123, 124, 125,
	127, 125, 124,
	124, 126, 127,
	138, 126, 124,
	134, 135, 136,
	137, 136, 135,
	143, 144, 145,
	145, 153, 143,
	153, 156, 143,
	143, 156, 162,
	146, 147, 148,
	150, 148, 147,
	147, 149, 150,
	161, 149, 147,
	157, 158, 159,
	160, 159, 158,
	166, 167, 168,
	168, 176, 166,
	176, 179, 166,
	166, 179, 185,
	169, 170, 171,
	173, 171, 170,
	170, 172, 173,
	184, 172, 170,
	180, 181, 182,
	183, 182, 181,
	189, 190, 191,
	191, 199, 189,
	199, 202, 189,
	189, 202, 208,
	192, 193, 194,
	196, 194, 193,
	193, 195, 196,
	207, 195, 193,
	203, 204, 205,
	206, 205, 204,
	211, 212, 213,
	213, 221, 211,
	221, 224, 211,
	211, 224, 230,
	214, 215, 216,
	218, 216, 215,
	215, 217, 218,
	229, 217, 215,
	225, 226, 227,
	228, 227, 226,
];

export const triggerStarMesh = Mesh.fromArray(vertices, indexes);
