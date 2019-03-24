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
	[0.250118, -0.011992, 1.623817, 1.000000, 0.000000, -0.000000, 0.751514, 0.265156],
	[0.250118, -0.161988, 0.686317, 1.000000, 0.000000, -0.000000, 0.851082, 0.194305],
	[0.250118, -0.011992, 0.686317, 1.000000, 0.000000, -0.000000, 0.851082, 0.265156],
	[0.250118, -0.161988, 1.623817, 1.000000, 0.000000, -0.000000, 0.751514, 0.194305],
	[-0.249882, -0.011992, 1.623817, 0.000000, 0.000000, 1.000000, 0.751514, 0.512405],
	[0.250118, -0.161988, 1.623817, 0.000000, 0.000000, 1.000000, 0.739770, 0.265156],
	[0.250118, -0.011992, 1.623817, 0.000000, 0.000000, 1.000000, 0.751514, 0.265156],
	[-0.249882, -0.161988, 1.623817, 0.000000, 0.000000, 1.000000, 0.739770, 0.512405],
	[-0.249882, -0.161988, 0.686317, -1.000000, 0.000000, -0.000000, 0.851082, 0.582368],
	[-0.249882, -0.161988, 1.623817, -1.000000, 0.000000, -0.000000, 0.751514, 0.582368],
	[-0.249882, -0.011992, 1.623817, -1.000000, 0.000000, -0.000000, 0.751514, 0.512405],
	[-0.249882, -0.011992, 0.686317, -1.000000, 0.000000, -0.000000, 0.851082, 0.512405],
	[0.250118, -0.011992, 1.623817, 0.000000, 1.000000, -0.000000, 0.751514, 0.265156],
	[-0.249882, -0.011992, 0.686317, 0.000000, 1.000000, -0.000000, 0.851082, 0.512405],
	[-0.249882, -0.011992, 1.623817, 0.000000, 1.000000, -0.000000, 0.751514, 0.512405],
	[0.250118, -0.011992, 0.686317, 0.000000, 1.000000, -0.000000, 0.851082, 0.265156],
	[-0.249882, -0.161988, 0.686317, 0.000000, 0.000000, -1.000000, 0.862341, 0.512405],
	[-0.249882, -0.011992, 0.686317, 0.000000, 0.000000, -1.000000, 0.851082, 0.512405],
	[0.250118, -0.161988, 0.686317, 0.000000, 0.000000, -1.000000, 0.862341, 0.265156],
	[0.250118, -0.011992, 0.686317, 0.000000, 0.000000, -1.000000, 0.851082, 0.265156],
	[0.262618, -0.161988, 1.636317, 1.000000, 0.000000, -0.000000, 0.596450, 0.783422],
	[0.262618, -0.211986, -0.126183, 1.000000, 0.000000, -0.000000, 0.976923, 0.774861],
	[0.262618, -0.161988, -0.126183, 1.000000, 0.000000, -0.000000, 0.976923, 0.783422],
	[0.262618, -0.211986, 1.636317, 1.000000, 0.000000, -0.000000, 0.596450, 0.774861],
	[-0.262382, -0.161988, 1.636317, 0.000000, 0.000000, 1.000000, 0.596450, 0.840409],
	[0.262618, -0.211986, 1.636317, 0.000000, 0.000000, 1.000000, 0.577898, 0.783422],
	[0.262618, -0.161988, 1.636317, 0.000000, 0.000000, 1.000000, 0.596450, 0.783422],
	[-0.262382, -0.211986, 1.636317, 0.000000, 0.000000, 1.000000, 0.577898, 0.840409],
	[-0.262382, -0.211986, -0.126183, -1.000000, 0.000000, -0.000000, 0.976923, 0.848724],
	[-0.262382, -0.211986, 1.636317, -1.000000, 0.000000, -0.000000, 0.596450, 0.848724],
	[-0.262382, -0.161988, 1.636317, -1.000000, 0.000000, -0.000000, 0.596450, 0.840409],
	[-0.262382, -0.161988, -0.126183, -1.000000, 0.000000, -0.000000, 0.976923, 0.840409],
	[0.262618, -0.161988, 1.636317, 0.000000, 1.000000, -0.000000, 0.596450, 0.783422],
	[-0.262382, -0.161988, -0.126183, 0.000000, 1.000000, -0.000000, 0.976923, 0.840409],
	[-0.262382, -0.161988, 1.636317, 0.000000, 1.000000, -0.000000, 0.596450, 0.840409],
	[0.262618, -0.161988, -0.126183, 0.000000, 1.000000, -0.000000, 0.976923, 0.783422],
	[0.262618, -0.211986, 1.636317, 0.000000, -1.000000, 0.000000, 0.596450, 0.774861],
	[-0.262382, -0.211986, 1.636317, 0.000000, -1.000000, 0.000000, 0.596449, 0.717835],
	[-0.262382, -0.211986, -0.126183, 0.000000, -1.000000, 0.000000, 0.976923, 0.717835],
	[0.262618, -0.211986, -0.126183, 0.000000, -1.000000, 0.000000, 0.976923, 0.774861],
	[0.250118, 0.163002, 1.423817, 1.000000, 0.000000, -0.000000, 0.634441, 0.925106],
	[0.250118, 0.113004, -0.126183, 1.000000, 0.000000, -0.000000, 0.976923, 0.916546],
	[0.250118, 0.163002, -0.126183, 1.000000, 0.000000, -0.000000, 0.976923, 0.925106],
	[0.250118, 0.113004, 1.423817, 1.000000, 0.000000, -0.000000, 0.634441, 0.916546],
	[-0.249882, 0.163002, 1.423817, 0.000000, 0.000000, 1.000000, 0.634441, 0.982093],
	[0.250118, 0.113004, 1.423817, 0.000000, 0.000000, 1.000000, 0.616511, 0.925106],
	[0.250118, 0.163002, 1.423817, 0.000000, 0.000000, 1.000000, 0.634441, 0.925106],
	[-0.249882, 0.113004, 1.423817, 0.000000, 0.000000, 1.000000, 0.616511, 0.982093],
	[-0.249882, 0.113004, -0.126183, -1.000000, 0.000000, -0.000000, 0.976923, 0.990409],
	[-0.249882, 0.113004, 1.423817, -1.000000, 0.000000, -0.000000, 0.634441, 0.990409],
	[-0.249882, 0.163002, 1.423817, -1.000000, 0.000000, -0.000000, 0.634441, 0.982093],
	[-0.249882, 0.163002, -0.126183, -1.000000, 0.000000, -0.000000, 0.976923, 0.982093],
	[0.250118, 0.163002, 1.423817, 0.000000, 1.000000, -0.000000, 0.634441, 0.925106],
	[-0.249882, 0.163002, -0.126183, 0.000000, 1.000000, -0.000000, 0.976923, 0.982093],
	[-0.249882, 0.163002, 1.423817, 0.000000, 1.000000, -0.000000, 0.634441, 0.982093],
	[0.250118, 0.163002, -0.126183, 0.000000, 1.000000, -0.000000, 0.976923, 0.925106],
	[0.250118, 0.113004, 1.423817, 0.000000, -1.000000, 0.000000, 0.634441, 0.916546],
	[-0.249882, 0.113004, 1.423817, 0.000000, -1.000000, 0.000000, 0.634441, 0.859519],
	[-0.249882, 0.113004, -0.126183, 0.000000, -1.000000, 0.000000, 0.976923, 0.859519],
	[0.250118, 0.113004, -0.126183, 0.000000, -1.000000, 0.000000, 0.976923, 0.916546],
	[-0.337382, 0.199603, 1.673817, -0.514000, 0.854900, 0.069800, 0.536081, 0.099737],
	[-0.330683, 0.199603, 1.698817, -0.459800, 0.847400, 0.265400, 0.546986, 0.102659],
	[-0.287382, 0.213000, 1.673817, -0.108700, 0.988100, 0.108700, 0.536081, 0.121547],
	[-0.312382, 0.199603, 1.717119, -0.265400, 0.847400, 0.459800, 0.554969, 0.110642],
	[-0.287382, 0.199603, 1.723817, -0.069800, 0.854900, 0.514000, 0.557891, 0.121547],
	[-0.362382, 0.163002, 1.717119, -0.758600, 0.482300, 0.438000, 0.554969, 0.088832],
	[-0.373984, 0.163002, 1.673817, -0.865300, 0.488300, 0.112900, 0.536081, 0.083771],
	[-0.373984, 0.113004, 1.723817, -0.858900, 0.127800, 0.495900, 0.562689, 0.078654],
	[-0.387382, 0.113004, 1.673817, -0.983400, 0.128100, 0.128100, 0.540443, 0.072693],
	[-0.337382, 0.113004, 1.760420, -0.495900, 0.127800, 0.858900, 0.578974, 0.094939],
	[-0.330683, 0.163002, 1.748817, -0.438000, 0.482300, 0.758600, 0.568795, 0.102659],
	[-0.287382, 0.163002, 1.760420, -0.112900, 0.488300, 0.865300, 0.573856, 0.121547],
	[-0.287382, 0.113004, 1.773817, -0.128100, 0.128100, 0.983400, 0.584934, 0.117185],
	[0.127152, 0.188001, 1.121198, 0.165400, 0.983900, -0.068500, 0.987454, 0.119858],
	[0.000118, 0.213015, 1.173817, 0.000000, 1.000000, -0.000000, 0.910599, 0.088024],
	[0.137619, 0.188001, 1.173817, 0.179000, 0.983900, -0.000000, 0.993786, 0.088024],
	[0.097346, 0.188001, 1.076590, 0.126600, 0.983900, -0.126600, 0.969421, 0.146846],
	[0.052737, 0.188001, 1.046783, 0.068500, 0.983900, -0.165400, 0.942433, 0.164879],
	[0.000118, 0.188001, 1.036317, -0.000000, 0.983900, -0.179000, 0.910599, 0.171211],
	[-0.052501, 0.188001, 1.046783, -0.068500, 0.983900, -0.165400, 0.878764, 0.164879],
	[-0.097109, 0.188001, 1.076590, -0.126600, 0.983900, -0.126600, 0.851776, 0.146846],
	[-0.126916, 0.188001, 1.121198, -0.165400, 0.983900, -0.068500, 0.833744, 0.119858],
	[-0.137382, 0.188001, 1.173817, -0.179000, 0.983900, -0.000000, 0.827411, 0.088024],
	[-0.126916, 0.188001, 1.226437, -0.165400, 0.983900, 0.068500, 0.833744, 0.056189],
	[-0.097109, 0.188001, 1.271045, -0.126600, 0.983900, 0.126600, 0.851776, 0.029202],
	[-0.052501, 0.188001, 1.300851, -0.068500, 0.983900, 0.165400, 0.878764, 0.011169],
	[0.000118, 0.188001, 1.311318, -0.000000, 0.983900, 0.179000, 0.910599, 0.004836],
	[0.052737, 0.188001, 1.300851, 0.068500, 0.983900, 0.165400, 0.942433, 0.011169],
	[0.097346, 0.188001, 1.271045, 0.126600, 0.983900, 0.126600, 0.969421, 0.029202],
	[0.127152, 0.188001, 1.226437, 0.165400, 0.983900, 0.068500, 0.987454, 0.056189],
	[0.140173, 0.212975, 1.115805, -0.804600, 0.491500, 0.333300, 0.292680, 0.308110],
	[0.127152, 0.188001, 1.121198, -0.804600, 0.491500, 0.333300, 0.295033, 0.302430],
	[0.137619, 0.188001, 1.173817, -0.870900, 0.491500, 0.000000, 0.317985, 0.306996],
	[0.151713, 0.212975, 1.173817, -0.870900, 0.491500, 0.000000, 0.317985, 0.313143],
	[0.107312, 0.212975, 1.066624, -0.615800, 0.491500, 0.615800, 0.271228, 0.293776],
	[0.097346, 0.188001, 1.076590, -0.615800, 0.491500, 0.615800, 0.275575, 0.289429],
	[0.058131, 0.212975, 1.033762, -0.333300, 0.491500, 0.804600, 0.256894, 0.272323],
	[0.052737, 0.188001, 1.046783, -0.333300, 0.491500, 0.804600, 0.262574, 0.269971],
	[0.000118, 0.212975, 1.022223, -0.000000, 0.491500, 0.870900, 0.251861, 0.247019],
	[0.000118, 0.188001, 1.036317, -0.000000, 0.491500, 0.870900, 0.258008, 0.247019],
	[-0.057895, 0.212975, 1.033762, 0.333300, 0.491500, 0.804600, 0.256894, 0.221714],
	[-0.052501, 0.188001, 1.046783, 0.333300, 0.491500, 0.804600, 0.262574, 0.224067],
	[-0.107075, 0.212975, 1.066624, 0.615800, 0.491500, 0.615800, 0.271228, 0.200262],
	[-0.097109, 0.188001, 1.076590, 0.615800, 0.491500, 0.615800, 0.275575, 0.204609],
	[-0.139937, 0.212975, 1.115805, 0.804600, 0.491500, 0.333300, 0.292680, 0.185928],
	[-0.126916, 0.188001, 1.121198, 0.804600, 0.491500, 0.333300, 0.295033, 0.191608],
	[-0.151476, 0.212975, 1.173817, 0.870900, 0.491500, -0.000000, 0.317985, 0.180895],
	[-0.137382, 0.188001, 1.173817, 0.870900, 0.491500, -0.000000, 0.317985, 0.187042],
	[-0.139937, 0.212975, 1.231830, 0.804600, 0.491500, -0.333300, 0.343290, 0.185928],
	[-0.126916, 0.188001, 1.226437, 0.804600, 0.491500, -0.333300, 0.340937, 0.191608],
	[-0.107075, 0.212975, 1.281011, 0.615800, 0.491500, -0.615800, 0.364742, 0.200262],
	[-0.097109, 0.188001, 1.271045, 0.615800, 0.491500, -0.615800, 0.360395, 0.204609],
	[-0.057895, 0.212975, 1.313872, 0.333300, 0.491500, -0.804600, 0.379076, 0.221714],
	[-0.052501, 0.188001, 1.300851, 0.333300, 0.491500, -0.804600, 0.373396, 0.224067],
	[0.000118, 0.212975, 1.325412, 0.000000, 0.491500, -0.870900, 0.384109, 0.247019],
	[0.000118, 0.188001, 1.311318, 0.000000, 0.491500, -0.870900, 0.377961, 0.247019],
	[0.058131, 0.212975, 1.313872, -0.333300, 0.491500, -0.804600, 0.379076, 0.272323],
	[0.052737, 0.188001, 1.300851, -0.333300, 0.491500, -0.804600, 0.373396, 0.269971],
	[0.107312, 0.212975, 1.281011, -0.615800, 0.491500, -0.615800, 0.364742, 0.293776],
	[0.097346, 0.188001, 1.271045, -0.615800, 0.491500, -0.615800, 0.360395, 0.289429],
	[0.140173, 0.212975, 1.231830, -0.804600, 0.491500, -0.333300, 0.343290, 0.308110],
	[0.127152, 0.188001, 1.226437, -0.804600, 0.491500, -0.333300, 0.340937, 0.302430],
	[-0.151476, 0.212975, 1.173817, 0.000200, 1.000000, 0.000000, 0.317985, 0.180895],
	[-0.287382, 0.213000, 0.673817, -0.108700, 0.988100, -0.108700, 0.099889, 0.121547],
	[0.000118, 0.212975, 1.325412, -0.000000, 1.000000, -0.000100, 0.384109, 0.247019],
	[0.287618, 0.213000, 1.673817, 0.108700, 0.988100, 0.108700, 0.536081, 0.372453],
	[0.151713, 0.212975, 1.173817, -0.000200, 1.000000, 0.000000, 0.317985, 0.313143],
	[0.287618, 0.213000, 0.673817, 0.108700, 0.988100, -0.108700, 0.099889, 0.372454],
	[0.000118, 0.212975, 1.022223, 0.000000, 1.000000, 0.000100, 0.251861, 0.247019],
	[-0.139937, 0.212975, 1.115805, 0.000100, 1.000000, 0.000000, 0.292680, 0.185928],
	[-0.107075, 0.212975, 1.066624, 0.000000, 1.000000, -0.000000, 0.271228, 0.200262],
	[-0.057895, 0.212975, 1.033762, 0.000000, 1.000000, 0.000100, 0.256894, 0.221714],
	[0.058131, 0.212975, 1.033762, 0.000000, 1.000000, 0.000100, 0.256894, 0.272323],
	[0.107312, 0.212975, 1.066624, 0.000000, 1.000000, -0.000000, 0.271228, 0.293776],
	[0.140173, 0.212975, 1.115805, -0.000100, 1.000000, 0.000000, 0.292680, 0.308110],
	[0.140173, 0.212975, 1.231830, -0.000100, 1.000000, 0.000000, 0.343290, 0.308110],
	[0.107312, 0.212975, 1.281011, 0.000000, 1.000000, -0.000000, 0.364742, 0.293776],
	[0.058131, 0.212975, 1.313872, -0.000000, 1.000000, -0.000100, 0.379076, 0.272323],
	[-0.057895, 0.212975, 1.313872, -0.000000, 1.000000, -0.000100, 0.379076, 0.221714],
	[-0.107075, 0.212975, 1.281011, 0.000000, 1.000000, -0.000000, 0.364742, 0.200262],
	[-0.139937, 0.212975, 1.231830, 0.000100, 1.000000, 0.000000, 0.343290, 0.185928],
	[0.287618, 0.199603, 1.723817, 0.069800, 0.854900, 0.514000, 0.557891, 0.372453],
	[0.287618, 0.163002, 1.760420, 0.112900, 0.488300, 0.865300, 0.573856, 0.372453],
	[0.287618, 0.113004, 1.773817, 0.128100, 0.128100, 0.983400, 0.584934, 0.376815],
	[-0.337382, 0.199603, 0.673817, -0.514000, 0.854900, -0.069800, 0.099889, 0.099737],
	[-0.387382, 0.113004, 0.673817, -0.983400, 0.128100, -0.128100, 0.095527, 0.072693],
	[-0.373984, 0.163002, 0.673817, -0.865300, 0.488300, -0.112900, 0.099889, 0.083771],
	[0.330919, 0.199603, 1.698817, 0.459800, 0.847400, 0.265400, 0.546986, 0.391341],
	[0.337618, 0.199603, 1.673817, 0.514000, 0.854900, 0.069800, 0.536081, 0.394263],
	[0.312618, 0.199603, 1.717119, 0.265400, 0.847400, 0.459800, 0.554969, 0.383358],
	[0.387618, 0.113004, 1.673817, 0.983400, 0.128100, 0.128100, 0.540443, 0.421307],
	[0.374221, 0.163002, 1.673817, 0.865300, 0.488300, 0.112900, 0.536081, 0.410229],
	[0.362618, 0.163002, 1.717119, 0.758600, 0.482300, 0.438000, 0.554969, 0.405168],
	[0.374221, 0.113004, 1.723817, 0.858900, 0.127800, 0.495900, 0.562689, 0.415346],
	[0.330919, 0.163002, 1.748817, 0.438000, 0.482300, 0.758600, 0.568795, 0.391341],
	[0.337618, 0.113004, 1.760420, 0.495900, 0.127800, 0.858900, 0.578974, 0.399061],
	[0.337618, 0.199603, 0.673817, 0.514000, 0.854900, -0.069800, 0.099889, 0.394263],
	[0.387618, 0.113004, 0.673817, 0.983400, 0.128100, -0.128100, 0.095527, 0.421307],
	[0.374221, 0.163002, 0.673817, 0.865300, 0.488300, -0.112900, 0.099889, 0.410229],
	[-0.330683, 0.199603, 0.648817, -0.459800, 0.847400, -0.265400, 0.088984, 0.102659],
	[-0.312382, 0.199603, 0.630516, -0.265400, 0.847400, -0.459800, 0.081001, 0.110642],
	[-0.287382, 0.199603, 0.623817, -0.069800, 0.854900, -0.514000, 0.078079, 0.121547],
	[-0.362382, 0.163002, 0.630516, -0.758600, 0.482300, -0.438000, 0.081001, 0.088832],
	[-0.373984, 0.113004, 0.623817, -0.858900, 0.127800, -0.495900, 0.073281, 0.078654],
	[-0.330683, 0.163002, 0.598817, -0.438000, 0.482300, -0.758600, 0.067174, 0.102659],
	[-0.337382, 0.113004, 0.587215, -0.495900, 0.127800, -0.858900, 0.056996, 0.094939],
	[-0.287382, 0.163002, 0.587215, -0.112900, 0.488300, -0.865300, 0.062114, 0.121547],
	[-0.287382, 0.113004, 0.573817, -0.128100, 0.128100, -0.983400, 0.051035, 0.117185],
	[0.287618, 0.199603, 0.623817, 0.069800, 0.854900, -0.514000, 0.078079, 0.372454],
	[-0.274882, 0.163002, 0.587215, 0.000000, 0.575100, -0.818100, 0.062114, 0.127129],
	[-0.274882, 0.113004, 0.573817, 0.000000, 0.130500, -0.991400, 0.051035, 0.127129],
	[0.330919, 0.199603, 0.648817, 0.459800, 0.847400, -0.265400, 0.088984, 0.391341],
	[0.312618, 0.199603, 0.630516, 0.265400, 0.847400, -0.459800, 0.081001, 0.383358],
	[0.362618, 0.163002, 0.630516, 0.758600, 0.482300, -0.438000, 0.081001, 0.405168],
	[0.374221, 0.113004, 0.623817, 0.858900, 0.127800, -0.495900, 0.073281, 0.415346],
	[0.337618, 0.113004, 0.587215, 0.495900, 0.127800, -0.858900, 0.056996, 0.399061],
	[0.330919, 0.163002, 0.598817, 0.438000, 0.482300, -0.758600, 0.067174, 0.391341],
	[0.287618, 0.163002, 0.587215, 0.112900, 0.488300, -0.865300, 0.062114, 0.372454],
	[0.287618, 0.113004, 0.573817, 0.128100, 0.128100, -0.983400, 0.051035, 0.376815],
	[0.287618, -0.236985, 1.773817, 0.130500, 0.000000, 0.991400, 0.624977, 0.410184],
	[-0.287382, -0.236985, 1.773817, -0.130500, 0.000000, 0.991400, 0.624977, 0.083816],
	[-0.387382, -0.236985, 1.673817, -0.991400, 0.000000, 0.130500, 0.573812, 0.032651],
	[-0.387382, -0.236985, 0.673817, -0.991400, 0.000000, -0.130500, 0.062158, 0.032651],
	[0.387618, -0.236985, 1.673817, 0.991400, 0.000000, 0.130500, 0.573812, 0.461349],
	[0.374221, -0.236985, 1.723817, 0.866000, 0.000000, 0.500000, 0.599394, 0.454494],
	[0.337618, -0.236985, 1.760420, 0.500000, 0.000000, 0.866000, 0.618122, 0.435767],
	[0.387618, -0.236985, 0.673817, 0.991400, 0.000000, -0.130500, 0.062158, 0.461349],
	[0.287618, -0.236985, 0.573817, 0.130500, 0.000000, -0.991400, 0.010993, 0.410184],
	[0.275118, -0.236985, 0.573817, 0.000000, 0.000000, -1.000000, 0.010993, 0.382273],
	[0.275118, 0.113004, 0.573817, 0.000000, 0.130500, -0.991400, 0.051035, 0.366972],
	[0.275118, 0.163002, 0.587215, 0.000000, 0.575100, -0.818100, 0.062114, 0.366972],
	[-0.287382, -0.236985, 0.573817, -0.130500, 0.000000, -0.991400, 0.010993, 0.083816],
	[-0.274882, -0.236985, 0.573817, 0.000000, 0.000000, -1.000000, 0.010993, 0.111727],
	[0.287618, -0.236985, 1.723817, 0.000000, -1.000000, 0.000000, 0.314418, 0.778989],
	[0.287618, -0.236985, 1.773817, 0.000000, -1.000000, 0.000000, 0.327740, 0.778989],
	[-0.287382, -0.236985, 1.773817, 0.000000, -1.000000, 0.000000, 0.327740, 0.948942],
	[-0.287382, -0.236985, 1.723817, 0.000000, -1.000000, 0.000000, 0.314418, 0.948942],
	[-0.337382, -0.236985, 1.673817, 0.000000, -1.000000, 0.000000, 0.301096, 0.962264],
	[-0.387382, -0.236985, 1.673817, 0.000000, -1.000000, 0.000000, 0.301096, 0.975586],
	[-0.387382, -0.236985, 0.673817, 0.000000, -1.000000, 0.000000, 0.034658, 0.975586],
	[-0.337382, -0.236985, 0.673817, 0.000000, -1.000000, 0.000000, 0.034658, 0.962264],
	[0.337618, -0.236985, 1.673817, 0.000000, -1.000000, 0.000000, 0.301096, 0.765668],
	[0.387618, -0.236985, 1.673817, 0.000000, -1.000000, 0.000000, 0.301096, 0.752346],
	[0.374221, -0.236985, 1.723817, 0.000000, -1.000000, 0.000000, 0.314418, 0.755915],
	[0.330919, -0.236985, 1.698817, 0.000000, -1.000000, 0.000000, 0.307757, 0.767452],
	[0.337618, -0.236985, 1.760420, 0.000000, -1.000000, 0.000000, 0.324170, 0.765668],
	[0.312618, -0.236985, 1.717119, 0.000000, -1.000000, 0.000000, 0.312633, 0.772328],
	[0.337618, -0.236985, 0.673817, 0.000000, -1.000000, 0.000000, 0.034658, 0.765668],
	[0.387618, -0.236985, 0.673817, 0.000000, -1.000000, 0.000000, 0.034658, 0.752346],
	[0.275118, -0.236985, 0.623817, 0.000000, -1.000000, 0.000000, 0.021336, 0.793524],
	[0.275118, -0.236985, 0.573817, 0.000000, -1.000000, 0.000000, 0.008015, 0.793524],
	[0.287618, -0.236985, 0.573817, 0.000000, -1.000000, 0.000000, 0.008015, 0.778989],
	[0.287618, -0.236985, 0.623817, 0.000000, -1.000000, 0.000000, 0.021336, 0.778989],
	[-0.287382, -0.236985, 0.623817, 0.000000, -1.000000, 0.000000, 0.021336, 0.948942],
	[-0.287382, -0.236985, 0.573817, 0.000000, -1.000000, 0.000000, 0.008015, 0.948942],
	[-0.274882, -0.236985, 0.573817, 0.000000, -1.000000, 0.000000, 0.008015, 0.934407],
	[-0.274882, -0.236985, 0.623817, 0.000000, -1.000000, 0.000000, 0.021336, 0.934407],
	[-0.373984, -0.236985, 1.723817, -0.866000, 0.000000, 0.500000, 0.599394, 0.039506],
	[-0.337382, -0.236985, 1.760420, -0.500000, 0.000000, 0.866000, 0.618122, 0.058233],
	[-0.373984, -0.236985, 1.723817, 0.000000, -1.000000, 0.000000, 0.314418, 0.972016],
	[-0.330683, -0.236985, 1.698817, 0.000000, -1.000000, 0.000000, 0.307757, 0.960479],
	[-0.312382, -0.236985, 1.717119, 0.000000, -1.000000, 0.000000, 0.312633, 0.955603],
	[-0.337382, -0.236985, 1.760420, 0.000000, -1.000000, 0.000000, 0.324170, 0.962264],
	[0.374221, -0.236985, 0.623817, 0.866000, 0.000000, -0.500000, 0.036576, 0.454494],
	[0.337618, -0.236985, 0.587215, 0.500000, 0.000000, -0.866000, 0.017848, 0.435767],
	[0.374221, -0.236985, 0.623817, 0.000000, -1.000000, 0.000000, 0.021336, 0.755915],
	[0.330919, -0.236985, 0.648817, 0.000000, -1.000000, 0.000000, 0.027997, 0.767452],
	[0.312618, -0.236985, 0.630516, 0.000000, -1.000000, 0.000000, 0.023121, 0.772328],
	[0.337618, -0.236985, 0.587215, 0.000000, -1.000000, 0.000000, 0.011584, 0.765668],
	[-0.373984, -0.236985, 0.623817, -0.866000, 0.000000, -0.500000, 0.036576, 0.039506],
	[-0.337382, -0.236985, 0.587215, -0.500000, 0.000000, -0.866000, 0.017848, 0.058233],
	[-0.373984, -0.236985, 0.623817, 0.000000, -1.000000, 0.000000, 0.021336, 0.972016],
	[-0.330683, -0.236985, 0.648817, 0.000000, -1.000000, 0.000000, 0.027997, 0.960479],
	[-0.337382, -0.236985, 0.587215, 0.000000, -1.000000, 0.000000, 0.011584, 0.962264],
	[-0.312382, -0.236985, 0.630516, 0.000000, -1.000000, 0.000000, 0.023121, 0.955603],
	[0.287618, 0.163002, 1.723817, -0.130500, 0.000000, -0.991400, 0.292805, 0.798637],
	[0.287618, -0.236985, 1.723817, -0.130500, 0.000000, -0.991400, 0.314418, 0.778989],
	[-0.287382, -0.236985, 1.723817, 0.130500, 0.000000, -0.991400, 0.314418, 0.948942],
	[-0.287382, 0.163002, 1.723817, 0.130500, 0.000000, -0.991400, 0.292805, 0.929294],
	[-0.337382, 0.163002, 1.673817, 0.991400, 0.000000, -0.130500, 0.281448, 0.940651],
	[-0.337382, -0.236985, 1.673817, 0.991400, 0.000000, -0.130500, 0.301096, 0.962264],
	[-0.337382, -0.236985, 0.673817, 0.991400, 0.000000, 0.130500, 0.034658, 0.962264],
	[-0.337382, 0.163002, 0.673817, 0.991400, 0.000000, 0.130500, 0.054306, 0.940651],
	[0.337618, 0.163002, 1.673817, -0.991400, 0.000000, -0.130500, 0.281448, 0.787280],
	[0.337618, -0.236985, 1.673817, -0.991400, 0.000000, -0.130500, 0.301096, 0.765668],
	[0.330919, -0.236985, 1.698817, -0.866000, 0.000000, -0.500000, 0.307757, 0.767452],
	[0.330919, 0.163002, 1.698817, -0.866000, 0.000000, -0.500000, 0.287127, 0.788802],
	[0.337618, 0.163002, 0.673817, -0.991400, 0.000000, 0.130500, 0.054306, 0.787280],
	[0.337618, -0.236985, 0.673817, -0.991400, 0.000000, 0.130500, 0.034658, 0.765668],
	[0.275118, 0.113004, 0.573817, -1.000000, 0.000000, -0.000000, 0.031592, 0.801511],
	[0.275118, -0.236985, 0.573817, -1.000000, 0.000000, -0.000000, 0.008015, 0.793524],
	[0.275118, -0.236985, 0.623817, -1.000000, 0.000000, -0.000000, 0.021336, 0.793524],
	[0.275118, 0.163002, 0.623817, -1.000000, 0.000000, -0.000000, 0.042949, 0.801511],
	[0.275118, 0.163002, 0.623817, 0.000000, 0.000000, 1.000000, 0.042949, 0.801511],
	[0.275118, -0.236985, 0.623817, 0.000000, 0.000000, 1.000000, 0.021336, 0.793524],
	[0.287618, -0.236985, 0.623817, -0.130500, 0.000000, 0.991400, 0.021336, 0.778989],
	[0.287618, 0.163002, 0.623817, -0.130500, 0.000000, 0.991400, 0.042949, 0.798637],
	[-0.287382, 0.163002, 0.623817, 0.130500, 0.000000, 0.991400, 0.042949, 0.929294],
	[-0.287382, -0.236985, 0.623817, 0.130500, 0.000000, 0.991400, 0.021336, 0.948942],
	[-0.274882, -0.236985, 0.623817, 0.000000, 0.000000, 1.000000, 0.021336, 0.934407],
	[-0.274882, 0.163002, 0.623817, 0.000000, 0.000000, 1.000000, 0.042949, 0.926440],
	[-0.274882, 0.163002, 0.623817, 1.000000, 0.000000, -0.000000, 0.042949, 0.926440],
	[-0.274882, -0.236985, 0.623817, 1.000000, 0.000000, -0.000000, 0.021336, 0.934407],
	[-0.274882, 0.113004, 0.573817, 1.000000, 0.000000, -0.000000, 0.031592, 0.926440],
	[-0.274882, -0.236985, 0.573817, 1.000000, 0.000000, -0.000000, 0.008015, 0.934407],
	[0.312618, -0.236985, 1.717119, -0.500000, 0.000000, -0.866000, 0.312633, 0.772328],
	[0.312618, 0.163002, 1.717119, -0.500000, 0.000000, -0.866000, 0.291284, 0.792959],
	[-0.330683, 0.163002, 1.698817, 0.866000, 0.000000, -0.500000, 0.287127, 0.939130],
	[-0.330683, -0.236985, 1.698817, 0.866000, 0.000000, -0.500000, 0.307757, 0.960479],
	[-0.312382, 0.163002, 1.717119, 0.500000, 0.000000, -0.866000, 0.291284, 0.934973],
	[-0.312382, -0.236985, 1.717119, 0.500000, 0.000000, -0.866000, 0.312633, 0.955603],
	[0.330919, 0.163002, 0.648817, -0.866000, 0.000000, 0.500000, 0.048628, 0.788802],
	[0.330919, -0.236985, 0.648817, -0.866000, 0.000000, 0.500000, 0.027997, 0.767452],
	[0.312618, 0.163002, 0.630516, -0.500000, 0.000000, 0.866000, 0.044471, 0.792959],
	[0.312618, -0.236985, 0.630516, -0.500000, 0.000000, 0.866000, 0.023121, 0.772328],
	[-0.330683, -0.236985, 0.648817, 0.866000, 0.000000, 0.500000, 0.027997, 0.960479],
	[-0.330683, 0.163002, 0.648817, 0.866000, 0.000000, 0.500000, 0.048628, 0.939130],
	[-0.312382, -0.236985, 0.630516, 0.500000, 0.000000, 0.866000, 0.023121, 0.955603],
	[-0.312382, 0.163002, 0.630516, 0.500000, 0.000000, 0.866000, 0.044471, 0.934973],
	[0.275118, 0.163002, 0.587215, -1.000000, 0.000000, -0.000000, 0.034635, 0.801511],
	[-0.274882, 0.163002, 0.587215, 1.000000, 0.000000, -0.000000, 0.034635, 0.926440],
	[0.275118, 0.163002, 0.623817, 0.000000, -1.000000, 0.000000, 0.042949, 0.801511],
	[0.287618, 0.163002, 0.623817, 0.000000, -1.000000, 0.000000, 0.042949, 0.798637],
	[0.000118, 0.163002, 1.173817, 0.000000, -1.000000, 0.000000, 0.167877, 0.863975],
	[-0.274882, 0.163002, 0.623817, 0.000000, -1.000000, 0.000000, 0.042949, 0.926440],
	[0.312618, 0.163002, 0.630516, 0.000000, -1.000000, 0.000000, 0.044471, 0.792959],
	[0.330919, 0.163002, 0.648817, 0.000000, -1.000000, 0.000000, 0.048628, 0.788802],
	[0.337618, 0.163002, 0.673817, 0.000000, -1.000000, 0.000000, 0.054306, 0.787280],
	[0.337618, 0.163002, 1.673817, 0.000000, -1.000000, 0.000000, 0.281448, 0.787280],
	[0.330919, 0.163002, 1.698817, 0.000000, -1.000000, 0.000000, 0.287127, 0.788802],
	[0.312618, 0.163002, 1.717119, 0.000000, -1.000000, 0.000000, 0.291284, 0.792959],
	[0.287618, 0.163002, 1.723817, 0.000000, -1.000000, 0.000000, 0.292805, 0.798637],
	[-0.287382, 0.163002, 1.723817, 0.000000, -1.000000, 0.000000, 0.292805, 0.929294],
	[-0.312382, 0.163002, 1.717119, 0.000000, -1.000000, 0.000000, 0.291284, 0.934973],
	[-0.330683, 0.163002, 1.698817, 0.000000, -1.000000, 0.000000, 0.287127, 0.939130],
	[-0.337382, 0.163002, 1.673817, 0.000000, -1.000000, 0.000000, 0.281448, 0.940651],
	[-0.337382, 0.163002, 0.673817, 0.000000, -1.000000, 0.000000, 0.054306, 0.940651],
	[-0.330683, 0.163002, 0.648817, 0.000000, -1.000000, 0.000000, 0.048628, 0.939130],
	[-0.312382, 0.163002, 0.630516, 0.000000, -1.000000, 0.000000, 0.044471, 0.934973],
	[-0.287382, 0.163002, 0.623817, 0.000000, -1.000000, 0.000000, 0.042949, 0.929294],
	[0.275118, 0.163002, 0.587215, 0.000000, -1.000000, 0.000000, 0.034635, 0.801511],
	[-0.274882, 0.163002, 0.587215, 0.000000, -1.000000, 0.000000, 0.034635, 0.926440],

];

const indexes = [
	0, 1, 2,
	0, 3, 1,
	4, 5, 6,
	4, 7, 5,
	8, 9, 10,
	11, 8, 10,
	12, 13, 14,
	12, 15, 13,
	16, 17, 18,
	19, 18, 17,
	20, 21, 22,
	20, 23, 21,
	24, 25, 26,
	24, 27, 25,
	28, 29, 30,
	31, 28, 30,
	32, 33, 34,
	32, 35, 33,
	36, 37, 38,
	39, 36, 38,
	40, 41, 42,
	40, 43, 41,
	44, 45, 46,
	44, 47, 45,
	48, 49, 50,
	51, 48, 50,
	52, 53, 54,
	52, 55, 53,
	56, 57, 58,
	59, 56, 58,
	60, 61, 62,
	65, 61, 60,
	62, 138, 139,
	62, 139, 140,
	62, 124, 138,
	62, 140, 122,
	70, 61, 65,
	61, 63, 62,
	63, 61, 70,
	122, 123, 62,
	123, 122, 129,
	123, 129, 130,
	123, 130, 131,
	123, 131, 128,
	62, 123, 60,
	71, 63, 70,
	63, 64, 62,
	71, 64, 63,
	64, 141, 62,
	71, 142, 64,
	141, 64, 142,
	124, 62, 125,
	125, 62, 141,
	125, 137, 124,
	125, 136, 137,
	125, 135, 136,
	126, 135, 125,
	71, 70, 72,
	142, 71, 143,
	72, 143, 71,
	72, 70, 69,
	69, 70, 65,
	179, 143, 72,
	72, 180, 179,
	72, 69, 180,
	143, 179, 185,
	218, 180, 69,
	185, 155, 143,
	155, 142, 143,
	155, 185, 184,
	69, 67, 218,
	69, 65, 67,
	217, 218, 67,
	184, 153, 155,
	153, 184, 183,
	155, 154, 142,
	153, 154, 155,
	154, 141, 142,
	183, 150, 153,
	150, 183, 186,
	149, 141, 154,
	125, 141, 149,
	152, 154, 153,
	152, 149, 154,
	150, 152, 153,
	152, 147, 149,
	125, 149, 147,
	150, 151, 152,
	151, 147, 152,
	186, 157, 150,
	151, 150, 157,
	186, 223, 157,
	148, 147, 151,
	125, 147, 148,
	157, 158, 151,
	148, 151, 158,
	174, 157, 223,
	174, 158, 157,
	223, 224, 174,
	158, 156, 148,
	125, 148, 156,
	173, 158, 174,
	173, 156, 158,
	175, 174, 224,
	175, 173, 174,
	224, 187, 175,
	173, 171, 156,
	178, 175, 187,
	187, 188, 178,
	178, 188, 189,
	175, 176, 173,
	178, 176, 175,
	176, 171, 173,
	178, 189, 177,
	177, 176, 178,
	177, 189, 190,
	172, 171, 176,
	177, 172, 176,
	168, 177, 190,
	177, 168, 172,
	168, 190, 169,
	171, 172, 127,
	156, 171, 127,
	172, 168, 127,
	156, 127, 125,
	126, 125, 127,
	134, 126, 127,
	127, 133, 134,
	127, 132, 133,
	127, 128, 132,
	127, 123, 128,
	127, 168, 161,
	161, 123, 127,
	168, 169, 161,
	123, 161, 160,
	166, 161, 169,
	123, 160, 159,
	164, 161, 166,
	160, 161, 164,
	167, 166, 169,
	167, 169, 170,
	191, 170, 192,
	167, 170, 191,
	167, 191, 230,
	165, 166, 167,
	230, 165, 167,
	165, 164, 166,
	165, 230, 229,
	162, 160, 164,
	162, 159, 160,
	163, 164, 165,
	229, 163, 165,
	162, 164, 163,
	163, 229, 182,
	182, 145, 163,
	145, 162, 163,
	145, 182, 181,
	146, 159, 162,
	145, 146, 162,
	123, 159, 144,
	144, 159, 146,
	144, 60, 123,
	181, 68, 145,
	145, 68, 146,
	181, 217, 68,
	67, 68, 217,
	146, 66, 144,
	66, 146, 68,
	60, 144, 66,
	67, 66, 68,
	65, 60, 66,
	65, 66, 67,
	73, 74, 75,
	76, 74, 73,
	75, 74, 89,
	77, 74, 76,
	89, 74, 88,
	78, 74, 77,
	88, 74, 87,
	79, 74, 78,
	87, 74, 86,
	80, 74, 79,
	86, 74, 85,
	81, 74, 80,
	85, 74, 84,
	82, 74, 81,
	84, 74, 83,
	83, 74, 82,
	90, 91, 92,
	91, 90, 94,
	92, 93, 90,
	94, 95, 91,
	93, 92, 121,
	95, 94, 96,
	121, 120, 93,
	96, 97, 95,
	120, 121, 119,
	97, 96, 98,
	119, 118, 120,
	98, 99, 97,
	118, 119, 117,
	99, 98, 100,
	117, 116, 118,
	100, 101, 99,
	116, 117, 115,
	101, 100, 102,
	115, 114, 116,
	102, 103, 101,
	114, 115, 113,
	103, 102, 104,
	113, 112, 114,
	104, 105, 103,
	112, 113, 111,
	105, 104, 106,
	111, 110, 112,
	106, 107, 105,
	110, 111, 109,
	107, 106, 108,
	109, 108, 110,
	108, 109, 107,
	193, 194, 195,
	194, 193, 206,
	195, 196, 193,
	206, 205, 194,
	195, 222, 196,
	205, 206, 204,
	221, 196, 222,
	205, 204, 203,
	219, 221, 222,
	201, 203, 204,
	220, 221, 219,
	201, 202, 203,
	219, 198, 220,
	202, 201, 207,
	220, 198, 197,
	207, 208, 202,
	197, 198, 199,
	226, 208, 207,
	199, 200, 197,
	225, 208, 226,
	200, 199, 231,
	226, 227, 225,
	200, 231, 232,
	225, 227, 228,
	233, 232, 231,
	227, 212, 228,
	233, 234, 232,
	211, 228, 212,
	234, 233, 214,
	211, 212, 209,
	209, 210, 211,
	214, 213, 234,
	213, 214, 215,
	215, 216, 213,
	235, 236, 237,
	236, 235, 266,
	237, 238, 235,
	266, 265, 236,
	238, 237, 270,
	265, 266, 246,
	270, 269, 238,
	246, 245, 265,
	269, 270, 268,
	245, 246, 243,
	268, 267, 269,
	243, 244, 245,
	267, 268, 240,
	244, 243, 247,
	240, 239, 267,
	247, 248, 244,
	239, 240, 241,
	248, 247, 271,
	241, 242, 239,
	271, 272, 248,
	242, 241, 275,
	272, 271, 273,
	275, 276, 242,
	273, 274, 272,
	276, 275, 277,
	274, 273, 256,
	277, 278, 276,
	256, 255, 274,
	278, 277, 258,
	255, 256, 253,
	253, 254, 255,
	258, 257, 278,
	257, 258, 259,
	259, 260, 257,
	249, 250, 251,
	251, 252, 249,
	252, 279, 249,
	261, 262, 263,
	263, 280, 261,
	264, 263, 262,
	281, 282, 283,
	282, 285, 283,
	283, 285, 286,
	283, 286, 287,
	283, 287, 288,
	288, 289, 283,
	289, 290, 283,
	283, 290, 291,
	291, 292, 283,
	292, 293, 283,
	283, 293, 294,
	283, 294, 295,
	295, 296, 283,
	296, 297, 283,
	297, 298, 283,
	283, 298, 299,
	299, 284, 283,
	283, 284, 281,
	300, 281, 284,
	301, 300, 284,
];

export const hitTargetT2SlimMesh = Mesh.fromArray(vertices, indexes);
