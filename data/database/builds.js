exports.model = 'Build';
exports.rows = [
	{
		id: '9.9.0',
		platform: 'vp',
		label: 'v9.9.0',
		download_url: 'http://www.vpforums.org/index.php?app=downloads&showfile=8793',
		support_url: '',
		built_at: '2014-04-29T00:00:00.000Z',
		description: '*This is the first release based on DirectX 9.*\n\n\
Please take a look at the [Table Upgrade Guide](https://github.com/c-f-h/vpinball/wiki/Table-Upgrade-Guide) for some additional help with problematic VP 9.2.1 (or lower) tables (and more).\n\
In case your setup cannot handle VP 9.9.0 properly for whatever reason, please download VP 9.2.1 instead, which was the last release still based on DirectX 7.\n\
\n\
### Changelog\n\
\n\
* Rendering engine has been ported to DirectX 9 and now takes much better advantage of 3D hardware\n\
* Region Updates, Region Optimization, Alternate Render are not needed anymore due to the new graphics pipeline and have been removed\n\
* True fullscreen setting has been removed due to incompatibility with VPinMAME. Instead, a windowed fullscreen option has been added to the list of video modes\n\
* Add options for wire ramps (define diameter and distance x/y of wires)\n\
* Add sphere mapping to wired ramps if an image was assigned to a wired ramp\n\
* Add CurrentAngle function to spinner\n\
* Add depth bias option to flasher, light, primitive and ramp to fine tune depth sorting\n\
* Enable NVIDIA Optimus cards by default\n\
* New video setting: Force anisotropic texture filtering. This results in higher quality results, but can affect performance on lower end cards\n\
* Stereo 3D AA is now basically for free and can always be enabled if stereo 3D output is used (currently stereo 3D is limited to NVIDIA only though)\n\
  Note that the depth/parameters of stereo had to be changed. As a positive side effect, the two stereo parameters are the same for most tables now,\n\
  so there is now a global setting in the video preferences. These can still be overwritten per table though.\n\
  - FXAA now has two modes: Fast (similar to old setting) and Quality\n\
  - new FPS limiter field in Video Options:\n\
    - `0`: Disable frame limiting\n\
    - `1`: Enable vsync\n\
\n\
    If set to anything higher than the monitor refresh rate, the engine will limit the FPS to this rate (but of course without using real hardware vsync). Adaptive vsync had to be disabled for now for compatibility with Windows XP.\n\
* New field "Maximum prerendered frames" in Video Options: Lowering this value will reduce input lag and sometimes also stutter, but may come at a performance cost.\n\
* Running as administrator is no longer required (except for tables which write high scores to system directories). UAC setting removed from executable.\n\
* Updated to latest FreeImage.dll (3.16.0)\n\
* Script editor updated to use latest scintilla (3.4.1)\n\
* Technical note: the minimum version to compile VP is now visual studio 2008 (incl. feature pack)\n',
		type: 'release',
		is_range: false,
		is_active: true
	},
	{
		id: '9.2.1',
		platform: 'vp',
		label: 'v9.2.1',
		download_url: 'http://www.vpforums.org/index.php?app=downloads&showfile=8793',
		support_url: '',
		built_at: '2014-03-21T00:00:00.000Z',
		description: '*This is the final release to be based on DirectX 7.*\n\
\n\
### Changelog\n\
\n\
- Add "To Collection" to the context menu to assign a selected element to a collection.\n\
- Add moving of single selected collection in the collection manager.\n\
- Add `CurrentAngle()` function to the gate object.\n\
- Add *"Is Toy"* checkbox to disable collision handling on mesh primitives completely.\n\
- Add collision detection to mesh primitives together with hit threshold and hit event.\n\
- Add Z offset to the backdrop options. With this settings you\'re able to zoom in/out the table without changing FOV/Inclination/Layback settings.\n\
- Add Z scale option to the backdrop options. With this setting you\'re able to reduce/increase the overall depth of a table.\n\
- Add table dimension manager for an easy way to calculate real table dimensions into VP table units and vice versa\n\
A add a ball throwing feature to VP. To use it check *"Throw Balls in Player"* in the debug window (ESC -> *"Debug Window"*) and by left clicking and holding the left mouse button you create a new ball and it throws the ball in that direction you move the mouse cursor when you release the left mouse button. If you click on a non moving ball you can reuse that ball and no new calls will be created. A right click on a ball will remove that ball from the table.\n\
- Add touch support for tablets (windows 8 and upwards). Current mapping:\n\
  - Upper left - add credit\n\
  - Middle upper left - left magna save/2nd button\n\
  - Middle lower left - left flipper\n\
  - Lower left - start\n\
  - Upper right - quit (press for 2 seconds to exit VP completely)\n\
  - Middle upper right - right magna save/2nd button\n\
  - Middle lower right - right flipper\n\
  - Lower right - plunger\n\
- Add Alpha-Flasher element. Use this element to add (additive) alpha flashers instead of abusing the alpha ramp element. The flasher is a "dynamic" element, that means it is not pre-rendered and it\'ll be updated every frame. *Limitations:* \n\
  - If "Display Image In Editor" option is selected and the flasher is rotated the image won\'t rotate due to a DX7 limitation.\n\
  - If the flasher is not an additive alpha flasher you can colorize the image with `Color` if you don\'t want that effect set the color to blank white (RGB 255,255,255).\n\
- Add height offset to bumper element\n\
- Add additional (optional) parameters to PlaySound to increase/decrease the frequency, apply all the settings to an already playing sample and choose if to restart this sample from the beginning or not\n\
all parameters are now: `PlaySound "name"`, `loopcount`, `volume`, `pan`, `randompitch`, `pitch`, `useexisting`, `restart`. \n\
  - `pitch` can be positive or negative and directly adds onto the standard sample frequency\n\
  - `useexisting` is 0 or 1 (if no existing/playing copy of the sound is found, then a new one is created)\n\
  - `restart` is 0 or 1 (only useful if useexisting is 1)\n\
- Per table setting of adaptive vsync (-1 = default, 0 = off, 1 = automatic detection, anything else: refresh rate in Hz)\n\
- Change per table settings for AA, FXAA and ball reflection (-1 takes the default from the video preferences, 0 forces off, 1 forces on)\n\
- Tweak key input code to save one frame (or more?) of lag\n\
- Change the old `Physics Max.Looptime` setting to `Physics Max.Loops`. It allows to specify the maximum number of iterations spent in the physics update. By setting it f.e. to 1, the rendered frame updates will *always* match the physics updates, everything above 1 allows for multiple physics updates per frame (2, 3 or 4 can be good values for this, as it slows down the physics temporarily if the FPS drop below 50, 33 or 25 in these cases).\n\
- Import/export of global physics options sets\n\
- Import/export of local/table physics options sets (that could then be reused globally of course and the other way round). Note that for local/table export the first found flipper is used to export the flipper physics settings (and for import all flippers will be assigned with the same settings)\n\
- Add optional ball trails/motion blur (also adjustable per-table)\n\
- Add script option `DisableLighting` for balls to disable lighting. This also allows to change the color of the ball via `Color` directly.\n\
- Add enabled flag to flippers\n\
- Separate/new texture maps for the lighting of lights (more details) and bumpers (brighter)\n\
- Fix problem with DMD/VPinMAME window being hidden behind VP window\n\
- Secondary/backglass sound output (by DJRobX)\n\
- If a sound effect contains `bgout_` in the name or `* Backglass Output *` in its path then it is played via the secondary sound output (music always). This can also be done with existing tables by using the new `To BG Out` button in the sound manager\n\
- Script editor updated to use latest scintilla (3.3.9)',
		type: 'release',
		is_range: false,
		is_active: true
	},
	{
		id: 'physmod2',
		platform: 'vp',
		label: 'physmod2',
		download_url: 'http://www.vpforums.org/index.php?showtopic=27416&p=261813',
		support_url: 'http://www.vpforums.org/index.php?showtopic=27416',
		built_at: '2014-04-13T21:36:00.000Z',
		description: '### Changes:\n\
- The following flipper parameters are now configurable: friction, return speed\n\
- Playfield friction is now configurable (Backdrop > Physics & Graphics)\n\
- Fixed a long-standing collision bug on very steep/curved ramps (e.g. AFM right ramp)\n\
- Fixed ball jumping on flipper resting in up position',
		type: 'experimental',
		is_range: false,
		is_active: true
	},
	{
		id: 'physmod5',
		platform: 'vp',
		label: 'physmod5',
		download_url: 'http://www.vpforums.org/index.php?showtopic=27416&page=32#entry266075',
		support_url: 'http://www.vpforums.org/index.php?showtopic=27416',
		built_at: '2014-05-18T01:24:00.000Z',
		description: '### Changes since `physmod4`:\n\
- Bugfix to keyboard nudging, ball now returns much closer to its original position. Nudge Time should also be set a bit higher now, 10-20 seems ok.\n\
- Fixed ball dropping through table when hitting walls at a certain angle.\n\
- Fixed ball dropping through table when hitting upper edge of walls from the outside.\n\
- Fixed bug with start/end posts of ramps being located at the wrong height.\n\
- Default table is now included in the executable, use *File > New* to load it.\n\n\
This version also has the latest updates from VP 9.9.0.',
		type: 'experimental',
		is_range: false,
		is_active: true
	},
	{
		id: 'rubberdemo4',
		platform: 'vp',
		label: 'rubberdemo4',
		download_url: 'http://www.vpforums.org/index.php?showtopic=27604&p=273142',
		support_url: 'http://www.vpforums.org/index.php?showtopic=27604',
		built_at: '2014-07-21T20:51:00.000Z',
		type: 'experimental',
		is_range: false,
		is_active: true
	},
	{
		id: '9.2.1-r932',
		platform: 'vp',
		label: 'v9.2.1 rev 932',
		download_url: 'https://www.dropbox.com/sh/qx1yng3nm8cv8lr/AACbxkyAHpY1T5xjuum03dbZa/Daily%20VPinball%20Builds/VPinball%209.2.1%20rev932.exe',
		support_url: '',
		built_at: '2014-03-04T00:00:00.000Z',
		description: 'Commit Message: `add comment on 2 sec exit`',
		type: 'nightly',
		is_range: false,
		is_active: true
	},
	{
		id: '-9.2.1',
		platform: 'vp',
		label: '< v9.2.1',
		description: 'v9.2.1 or lower',
		built_at: '2014-03-21T00:00:00.000Z',
		type: 'release',
		is_range: true,
		is_active: true
	},
	{
		id: '-9.9.0',
		platform: 'vp',
		label: '< v9.9.0',
		description: 'v9.9.0 or lower',
		built_at: '2014-04-29T00:00:00.000Z',
		type: 'release',
		is_range: true,
		is_active: true
	},
	{
		id: '8.x',
		platform: 'vp',
		label: 'v8.x',
		description: 'Any v8.* build',
		built_at: '2009-02-07T15:23:00.000Z',
		type: 'release',
		is_range: true,
		is_active: true
	},
	{
		id: '10.x',
		platform: 'vp',
		label: 'VPX',
		description: 'VPX, for testing purposes',
		built_at: '2015-12-31T00:00:00.000Z',
		type: 'release',
		is_range: false,
		is_active: true
	}
];