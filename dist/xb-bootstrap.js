// this bootstrap script first turns off display of the document, then
// loads the init.js script to load everything else.  The last thing
// the init.js script does is to remove the display-hiding style from
// document.documentElement.
document.documentElement.style='display:none';
import('../dist/init.js');
