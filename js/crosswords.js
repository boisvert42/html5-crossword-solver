/**
Copyright (c) 2025, Crossword Nexus & Crossweird LLC
All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
**/

// Settings that we can save
const CONFIGURABLE_SETTINGS = [
  "skip_filled_letters"
  , "arrow_direction"
  , "space_bar"
  , "tab_key"
  , "timer_autostart"
  , "dark_mode_enabled"
  , "gray_completed_clues"
];
(function () {
  const isMobile = /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);
})();

// Since DarkReader is an external library, make sure it exists
try { DarkReader } catch { DarkReader = false; }

/**
* Helper functions
* mostly for colors
**/

// hex string to RGB array and vice versa
// thanks https://stackoverflow.com/a/39077686
const hexToRgb = hex =>
  hex.replace(/^#?([a-f\d])([a-f\d])([a-f\d])$/i
    , (m, r, g, b) => '#' + r + r + g + g + b + b)
    .substring(1).match(/.{2}/g)
    .map(x => parseInt(x, 16));

const rgbToHex = (r, g, b) => '#' + [r, g, b].map(x => {
  const hex = x.toString(16)
  return hex.length === 1 ? '0' + hex : hex
}).join('');

const isMobile = (() => {
  const ua = navigator.userAgent || navigator.vendor || window.opera;
  return (
    /android/i.test(ua) ||
    /iphone|ipad|ipod/i.test(ua) ||
    /mobile/i.test(ua) ||
    window.innerWidth <= 768
  );
})();

// perceived brightness of a color on a scale of 0-255
// via wx-xword
function getBrightness(hex) {
  const rgb = hexToRgb(hex);
  //return Math.sqrt(0.299 * rgb[0]**2 + 0.587 * rgb[1]**2 + 0.114 * rgb[2]**2);
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

// Helper function for a single component
function componentAvg(c1, c2, weight) {
  //return Math.floor(Math.sqrt(weight * c1**2 + (1 - weight) * c2**2));
  return Math.floor(weight * c1 + (1 - weight) * c2)
}
// helper function to take the "average" of two RGB strings
// thanks https://stackoverflow.com/a/29576746
function averageColors(c1, c2, weight = 0.5) {
  var r1 = hexToRgb(c1);
  var r2 = hexToRgb(c2);
  var newColor = [componentAvg(r1[0], r2[0], weight),
  componentAvg(r1[1], r2[1], weight),
  componentAvg(r1[2], r2[2], weight)]
  return rgbToHex(newColor[0], newColor[1], newColor[2]);
}

function adjustColor(color, amount) {
  return '#' + color.replace(/^#/, '').replace(/../g, color => ('0' + Math.min(255, Math.max(0, parseInt(color, 16) + amount)).toString(16)).substr(-2));
}

// Helper function to draw an arrow in a square
function drawArrow(context, top_x, top_y, square_size, direction = "right") {
  const headlen = square_size / 5; // length of the arrowhead
  const centerX = top_x + square_size / 2;
  const centerY = top_y + square_size / 2;
  let fromX, fromY, toX, toY;

  switch(direction) {
      case "right":
          fromX = top_x + square_size / 4;
          fromY = centerY;
          toX = top_x + (3 * square_size) / 4;
          toY = centerY;
          break;
      case "left":
          fromX = top_x + (3 * square_size) / 4;
          fromY = centerY;
          toX = top_x + square_size / 4;
          toY = centerY;
          break;
      case "up":
          fromX = centerX;
          fromY = top_y + (3 * square_size) / 4;
          toX = centerX;
          toY = top_y + square_size / 4;
          break;
      case "down":
          fromX = centerX;
          fromY = top_y + square_size / 4;
          toX = centerX;
          toY = top_y + (3 * square_size) / 4;
          break;
  }

  const dx = toX - fromX;
  const dy = toY - fromY;
  const angle = Math.atan2(dy, dx);

  context.beginPath();
  context.moveTo(fromX, fromY);
  context.lineTo(toX, toY);
  context.stroke();

  context.beginPath();
  context.moveTo(toX, toY);
  context.lineTo(toX - headlen * Math.cos(angle - Math.PI / 6), toY - headlen * Math.sin(angle - Math.PI / 6));
  context.moveTo(toX, toY);
  context.lineTo(toX - headlen * Math.cos(angle + Math.PI / 6), toY - headlen * Math.sin(angle + Math.PI / 6));
  context.stroke();
}

// Main crossword javascript for the Crossword Nexus HTML5 Solver
(function (global, factory) {
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = factory(global);
  } else {
    factory(global, true);
  }
})(
  typeof window !== 'undefined' ? window : this,
  function (window, registerGlobal) {
    'use strict';

    var default_config = {
      hover_enabled: false,
      color_hover: '#FFFFAA',
      color_selected: '#506E85',
      color_word: '#D7E9F5',
      color_hilite: '#506E85',
      /*color_word_shade: '#BAAB56',*/
      color_none: '#FFFFFF',
      background_color_clue: '#666666',
      default_background_color: '#c2ed7e',
      color_secondary: '#d7e1ec',
      font_color_clue: '#FFFFFF',
      font_color_fill: '#000000',
      color_block: '#212121',
      puzzle_file: null,
      puzzles: null,
      skip_filled_letters: true,
      arrow_direction: 'arrow_stay',
      space_bar: 'space_switch',
      filled_clue_color: '#999999',
      timer_autostart: false,
      dark_mode_enabled: false,
      tab_key: 'tab_skip',
      bar_linewidth: 2.5,
      gray_completed_clues: false,
    };

    // constants
    var FILE_JPZ = 'jpz';
    var FILE_PUZ = 'puz';
    var CLUES_TOP = 'clues_top';
    var CLUES_BOTTOM = 'clues_bottom';
    var MIN_SIZE = 10;
    var MAX_SIZE = 100;
    var SKIP_UP = 'up';
    var SKIP_DOWN = 'down';
    var SKIP_LEFT = 'left';
    var SKIP_RIGHT = 'right';
    var STORAGE_KEY = 'crossword_nexus_savegame';
    var SETTINGS_STORAGE_KEY = 'crossword_nexus_settings';

    // messages
    var MSG_SAVED = 'Crossword saved';
    var MSG_LOADED = 'Crossword loaded';
    var MSG_SOLVED = '<center>Way to go!</center>';

    var MAX_CLUES_LENGTH = 2;

    var TYPE_UNDEFINED = typeof undefined;
    var XMLDOM_ELEMENT = 1;
    var XMLDOM_TEXT = 3;
    var ZIPJS_CONFIG_OPTION = 'zipjs_path';
    var ZIPJS_PATH = 'lib/zip';

    // errors
    var ERR_FILE_LOAD = 'Error loading file';
    var ERR_PARSE_JPZ = 'Error parsing JPZ file... Not JPZ or zipped JPZ file.';
    var ERR_NOT_CROSSWORD = 'Error opening file. Probably not a crossword.';
    var ERR_NO_JQUERY = 'jQuery not found';
    var ERR_CLUES_GROUPS = 'Wrong number of clues in jpz file';
    var ERR_NO_PUZJS = 'Puz js not found';
    var ERR_LOAD = 'Error loading savegame - probably corrupted';
    var ERR_NO_SAVEGAME = 'No saved game found';

    var load_error = false;

    var CROSSWORD_TYPES = ['crossword', 'coded', 'acrostic'];
    var xw_timer,
      xw_timer_seconds = 0;

    /** Template will have to change along with CSS **/
    var template = `
      <div class="cw-main auto normal">
        <!-- Overlay for opening puzzles -->
        <div class="cw-open-holder">
          <div class="cw-overflow" style="
          
          background-position: center;
          background-size: 40%;
          background-repeat: no-repeat;"></div>
          <div class="cw-open-puzzle">
            <div class="cw-open-puzzle-instructions">
              Drag and drop a file here, or click the button to choose a file
              to open.
            </div>
            <button type="button" class="cw-button cw-button-open-puzzle">
              Open puzzle file
            </button>
            <div class="cw-open-puzzle-formats">
              <b>Accepted formats:</b> PUZ, JPZ, XML, CFP, and iPUZ (partial)
            </div>
          </div>
          <input type="file" class="cw-open-jpz" accept=".puz,.xml,.jpz,.xpz,.ipuz,.cfp">
        </div>
        <!-- End overlay -->
        <div class="cw-header">
          <div class="cw-header-box">
            <div class="cw-header-content">
              <div class="cw-title" id="cw-title"></div>
                <div class="cw-author" id="cw-author"></div>
            </div>
          </div>
        </div>
        <div class="cw-content">
          <!-- Placeholder for modal boxes -->
          <div class="cw-modal"></div>
            <div class="cw-grid">
                <div class="cw-buttons-holder">
                <div class="cw-menu-container">
                  <button type="button" class="cw-button">
                   File
                  <span class="cw-arrow"></span>
                </button>
                <div class="cw-menu">
                  <button class="cw-menu-item cw-file-info">Info</button>
                  <button class="cw-menu-item cw-file-notepad">Notepad</button>
                  <button class="cw-menu-item cw-file-print">Print</button>
                  <hr />
                  <button class="cw-menu-item cw-file-clear">Clear</button>
                  <hr />
                  <button class="cw-menu-item cw-file-download">Export JPZ</button>
                </div>
              </div>
              <div class="cw-menu-container cw-check">
                <button type="button" class="cw-button">
                   Check
                  <span class="cw-arrow"></span>
                </button>
                <div class="cw-menu">
                  <button class="cw-menu-item cw-check-letter">Letter</button>
                  <button class="cw-menu-item cw-check-word">Word</button>
                  <button class="cw-menu-item cw-check-puzzle">Puzzle</button>
                </div>
              </div>
              <div class="cw-menu-container cw-reveal">
                <button type="button" class="cw-button">
                   Reveal
                  <span class="cw-arrow"></span>
                </button>
                <div class="cw-menu">
                  <button class="cw-menu-item cw-reveal-letter">Letter</button>
                  <button class="cw-menu-item cw-reveal-word">Word</button>
                  <button class="cw-menu-item cw-reveal-puzzle">Puzzle</button>
                </div>
              </div>
              <div class="cw-menu-container cw-theme">
                <button type="button" class="cw-button">
                   Theme
                  <span class="cw-arrow"></span>
                </button>
                <div class="cw-menu">
                  <button class="cw-menu-item cw-theme-barbie">Barbie</button>
                  <button class="cw-menu-item cw-theme-cherry-blossom">Cherry Blossom</button>
                  <button class="cw-menu-item cw-theme-cryptic-crossweird">Cryptic Crossweird</button>
                  <button class="cw-menu-item cw-theme-dark">Dark</button>
                  <button class="cw-menu-item cw-theme-earth-tones">Earth Tones</button>
                  <button class="cw-menu-item cw-theme-frost">Frost</button>
                  <button class="cw-menu-item cw-theme-grape-soda">Grape Soda</button>
                  <button class="cw-menu-item cw-theme-light-blue">Light Blue</button>
                  <button class="cw-menu-item cw-theme-light-green">Light Green</button>
                  <button class="cw-menu-item cw-theme-momos-nail-corner">Momo's Nail Corner</button>
                  <button class="cw-menu-item cw-theme-pumpkin-spice">Pumpkin Spice</button>
                  <button class="cw-menu-item cw-theme-spring-pastels">Spring Pastels</button>
                  <button class="cw-menu-item cw-theme-taco-bell">Taco Bell</button>
                </div>
              </div>
              <button type="button" class="cw-button cw-settings-button">
                 Settings
              </button>
              <span class="cw-flex-spacer"></span>
              <button type="button" class="cw-button cw-button-notepad">Notes</button>
              <span class="cw-flex-spacer"></span>
              <button type="button" class="cw-button cw-button-timer">00:00</button>
            </div>

            <input type="text" class="cw-hidden-input">
              <div class="cw-canvas">
                <div class="cw-puzzle-container">
                  <div class="cw-top-text-wrapper">
                    <div class="cw-top-text">
                      <span class="cw-clue-number"></span>
                      <span class="cw-clue-text"></span>
                    </div>
                  </div>
                  <svg id="cw-puzzle-grid"></svg>
                </div>
              </div>
            </div>
          <div class="cw-clues-holder">
            <div class="cw-clues cw-clues-top">
              <div class="cw-clues-title"></div>
              <div class="cw-clues-items"></div>
            </div>
            <div class="cw-clues cw-clues-bottom">
              <div class="cw-clues-title"></div>
              <div class="cw-clues-items"></div>
            </div>
          </div>
        </div>
      </div>`;

    // returns deferred object
    function loadFileFromServer(path, type) {
      var xhr = new XMLHttpRequest(),
        deferred = $.Deferred();
      xhr.open('GET', path);
      xhr.responseType = 'blob';
      xhr.onload = function () {
        if (xhr.status == 200) {
          loadFromFile(xhr.response, type, deferred);
        } else {
          deferred.reject(ERR_FILE_LOAD);
        }
      };
      xhr.send();
      return deferred;
    }

    // Check if we can drag and drop files
    var isAdvancedUpload = (function () {
      var div = document.createElement('div');
      return (
        ('draggable' in div || ('ondragstart' in div && 'ondrop' in div)) &&
        'FormData' in window &&
        'FileReader' in window
      );
    })();

    function loadFromFile(file, type, deferred) {
      var reader = new FileReader();
      deferred = deferred || $.Deferred();
      reader.onload = function (event) {
        var string = event.target.result;
        deferred.resolve(string);
      };
      reader.readAsBinaryString(file);
      return deferred;
    }

    // Breakpoint config for the top clue, as tuples of `[max_width, max_size]`
    const maxClueSizes = [
      [1080, 15],
      [1200, 17],
      [Infinity, 21],
    ];

    /** Function to resize text **/
    function resizeText(rootElement, nodeList) {
      const minSize = 7;
      const rootWidth = rootElement.width();
      const maxSize = maxClueSizes.find(
        (breakpoint) => breakpoint[0] > rootWidth
      )[1];
      const step = 1;
      const unit = 'px';

      for (var j = 0; j < nodeList.length; j++) {
        const el = nodeList[j];
        let i = minSize;
        let overflow = false;
        const parent = el.parentNode;

        while (!overflow && i <= maxSize) {
          el.style.fontSize = `${i}${unit}`;
          // TODO: is this the best logic we can use here?
          overflow = parent.scrollHeight < el.clientHeight;
          if (!overflow) {
            i += step;
          }
        }
        // revert to last state where no overflow happened
        el.style.fontSize = `${i - step}${unit}`;
      }
    }

    // Breakpoint widths used by the stylesheet.
    const breakpoints = [420, 600, 850, 1080, 1200];

    function setBreakpointClasses(rootElement) {
      const rootWidth = rootElement.width();

      for (const breakpoint of breakpoints) {
        const className = `cw-max-width-${breakpoint}`;

        if (rootWidth <= breakpoint) {
          rootElement.addClass(className);
        } else {
          rootElement.removeClass(className);
        }
      }
    }

    // Function to check if a cell is solved correctly
    function isCorrect(entry, solution) {
      // if we have a rebus or non-alpha solution or no solution, accept anything
      if (entry && (!solution || solution.length > 1 || /[^A-Za-z]/.test(solution))) {
        return true;
      }
      // otherwise, only mark as okay if we have an exact match
      else {
        return entry == solution;
      }
    }

    /**
     * Sanitize HTML in the given string, except the simplest no-attribute
     * formatting tags.
     */
    const entityMap = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
      '/': '&#x2F;',
      '`': '&#x60;',
      '=': '&#x3D;',
    };
    const escapeRegex = new RegExp(
      `</?(i|b|em|strong|span|br|p)>|[&<>"'\`=\\/]`,
      'g'
    );
    function escape(string) {
      //return String(string).replace(escapeRegex, (s) =>
      //  s.length > 1 ? s : entityMap[s]
      //);
      return string;
    }

    var CrosswordNexus = {
      createCrossword: function (parent, user_config) {
        var crossword;
        try {
          if (typeof jQuery === TYPE_UNDEFINED) {
            throw new Error(ERR_NO_JQUERY);
          }
          crossword = new CrossWord(parent, user_config);
        } catch (e) {
          alert(e.message);
          console.log(e);
        }
        return crossword;
      },
    };

    class CrossWord {
      constructor(parent, user_config) {
        this.parent = parent;
        this.config = {};
        // Load solver config
        var saved_settings = {};
        try {
          saved_settings = JSON.parse(
            localStorage.getItem(SETTINGS_STORAGE_KEY)
          );
        } catch (error) {
          console.log(error);
        }
        var i;
        var configurable_settings_set = new Set(CONFIGURABLE_SETTINGS);
        for (i in default_config) {
          if (default_config.hasOwnProperty(i)) {
            // Check saved settings before "user" settings
            // only configurable settings can be loaded
            if (saved_settings && saved_settings.hasOwnProperty(i) && configurable_settings_set.has(i)) {
              this.config[i] = saved_settings[i];
            } else if (user_config && user_config.hasOwnProperty(i)) {
              this.config[i] = user_config[i];
            } else {
              this.config[i] = default_config[i];
            }
          }
        }

        /** enable dark mode if available **/
        if (this.config.dark_mode_enabled && DarkReader) {
          DarkReader.enable({
            brightness: 100,
            contrast: 90,
            sepia: 55
          });
          this.config.color_none = '#F2F2F2';
          this.config.color_selected = '#5C5C42';
          this.config.color_word = '#9E9E77';
          //this.config.font_color_fill = '#ddd4c5';
        }

        this.cell_size = 40;
        //this.top_text_height = 0;
        //this.bottom_text_height = 0;
        this.grid_width = 0;
        this.grid_height = 0;
        this.cells = {};
        this.words = {};
        this.clues_top = null;
        this.clues_bottom = null;
        this.active_clues = null;
        this.inactive_clues = null;
        this.hovered_x = null;
        this.hovered_y = null;
        this.selected_word = null;
        this.hilited_word = null;
        this.selected_cell = null;
        this.settings_open = false;
        // TIMER
        this.timer_running = false;

        /*// Solution message
        this.msg_solved = MSG_SOLVED;*/

        // whether to show the reveal button
        this.has_reveal = true;

        this.handleClickWindow = this.handleClickWindow.bind(this);
        this.windowResized = this.windowResized.bind(this);

        this.init();
      }

      init() {
        var parsePUZZLE_callback = $.proxy(this.parsePuzzle, this);
        var error_callback = $.proxy(this.error, this);

        if (this.root) {
          this.remove();
        }

        // build structures
        this.root = $(template);
        this.top_text = this.root.find('div.cw-top-text');
        //this.bottom_text = this.root.find('div.cw-bottom-text');
        this.clues_holder = this.root.find('div.cw-clues-holder');
        this.clues_top_container = this.root.find('div.cw-clues-top');
        this.clues_bottom_container = this.root.find('div.cw-clues-bottom');

        this.toptext = this.root.find('.cw-top-text-wrapper');
        this.notes = new Map();

        this.settings_btn = this.root.find('.cw-settings-button');

        this.hidden_input = this.root.find('input.cw-hidden-input');
        this.reveal_letter = this.root.find('.cw-reveal-letter');
        this.reveal_word = this.root.find('.cw-reveal-word');
        this.reveal_puzzle = this.root.find('.cw-reveal-puzzle');

        // EDIT TO ADD THEME
        this.theme_light_blue = this.root.find('.cw-theme-light-blue');
        this.theme_light_green = this.root.find('.cw-theme-light-green');
        this.theme_pumpkin_spice = this.root.find('.cw-theme-pumpkin-spice');
        this.theme_dark = this.root.find('.cw-theme-dark');
        this.theme_barbie = this.root.find('.cw-theme-barbie');
        this.theme_taco_bell = this.root.find('.cw-theme-taco-bell');
        this.theme_earth_tones = this.root.find('.cw-theme-earth-tones');
        this.theme_grape_soda = this.root.find('.cw-theme-grape-soda');
        this.theme_cherry_blossom = this.root.find('.cw-theme-cherry-blossom');
        this.theme_momos_nail_corner = this.root.find('.cw-theme-momos-nail-corner');
        this.theme_frost = this.root.find('.cw-theme-frost');
        this.theme_cryptic_crossweird = this.root.find('.cw-theme-cryptic-crossweird');
        this.theme_spring_pastels = this.root.find('.cw-theme-spring-pastels');

        this.check_letter = this.root.find('.cw-check-letter');
        this.check_word = this.root.find('.cw-check-word');
        this.check_puzzle = this.root.find('.cw-check-puzzle');

        this.info_btn = this.root.find('.cw-file-info');
        this.load_btn = this.root.find('.cw-file-load');
        this.print_btn = this.root.find('.cw-file-print');
        this.clear_btn = this.root.find('.cw-file-clear');
        this.save_btn = this.root.find('.cw-file-save');
        this.download_btn = this.root.find('.cw-file-download');

        // Notepad button is hidden by default
        this.notepad_btn = this.root.find('.cw-file-notepad');
        this.notepad_btn.hide();

        this.timer_button = this.root.find('.cw-button-timer');
        this.xw_timer_seconds = 0;

        // function to process uploaded files
        function processFiles(files) {
          loadFromFile(files[0], FILE_PUZ).then(
            parsePUZZLE_callback,
            error_callback
          );
        }

        // preload one puzzle
        if (
          this.config.puzzle_file &&
          this.config.puzzle_file.hasOwnProperty('url') &&
          this.config.puzzle_file.hasOwnProperty('type')
        ) {
          this.root.addClass('loading');
          var loaded_callback = parsePUZZLE_callback;
          loadFileFromServer(
            this.config.puzzle_file.url,
            this.config.puzzle_file.type
          ).then(loaded_callback, error_callback);
        } else {
          // shows open button
          var i, puzzle_file, el;

          this.open_button = this.root.find('.cw-button-open-puzzle');
          this.file_input = this.root.find('input[type="file"]');

          this.open_button.on('click', () => {
            this.file_input.click();
          });

          this.file_input.on('change', () => {
            var files = this.file_input[0].files.length
              ? this.file_input[0].files
              : null;
            if (files) {
              processFiles(files);
            }
          });

          // drag-and-drop
          if (isAdvancedUpload) {
            const div_open_holder = this.root.find('div.cw-open-holder');
            const div_overflow = this.root.find('div.cw-overflow');
            div_overflow.addClass('has-advanced-upload');

            var droppedFiles = false;

            div_open_holder
              .on(
                'drag dragstart dragend dragover dragenter dragleave drop',
                function (e) {
                  e.preventDefault();
                  e.stopPropagation();
                }
              )
              .on('dragover dragenter', function () {
                div_overflow.addClass('is-dragover');
              })
              .on('dragleave dragend drop', function () {
                div_overflow.removeClass('is-dragover');
              })
              .on('drop', function (e) {
                droppedFiles = e.originalEvent.dataTransfer.files;
                processFiles(droppedFiles);
              });
          }
        }

        // mapping of number to cells
        this.number_to_cells = {};
        // the crossword type
        this.crossword_type = 'crossword';
        // whether the puzzle is autofill
        this.is_autofill = false;

        this.root.appendTo(this.parent);
        this.canvas_holder = this.root.find('div.cw-canvas');
        // SVG setup (new)
        this.svgNS = 'http://www.w3.org/2000/svg';
        this.svgContainer = document.createElementNS(this.svgNS, 'svg');
        this.svgContainer.setAttribute('id', 'cw-puzzle-grid');
        // Preserve existing top text wrapper while replacing only the canvas
        this.canvas_holder.find('#cw-puzzle-grid').remove();  // Remove old canvas only

        this.canvas_holder.append(this.svgContainer);         // Add new SVG crossword
        this.svg = $('#cw-puzzle-grid');

        setBreakpointClasses(this.root);
            // Place this at the END of the init() method:
        const svg = document.getElementById('cw-puzzle-grid');
      }

      error(message) {
        alert(message);
      }

      /** Parse a puzzle using JSCrossword **/
      parsePuzzle(string) {
        // if "string" is actually an object assume it's already a jsxw
        var puzzle;
        if (typeof (string) == "object") {
          puzzle = string;
        } else {
          var xw_constructor = new JSCrossword();
          puzzle = xw_constructor.fromData(string);
        }
        // we keep the original JSCrossword object as well
        this.jsxw = puzzle;
        // set the savegame_name
        const simpleHash = t => { let e = 0; for (let r = 0; r < t.length; r++) { e = (e << 5) - e + t.charCodeAt(r), e &= e } return new Uint32Array([e])[0].toString(36) };
        const myHash = simpleHash(JSON.stringify(this.jsxw));
        this.savegame_name = STORAGE_KEY + '_' + myHash;

        // if this savegame name exists, load it
        var jsxw2_cells = this.loadGame();
        if (jsxw2_cells) {
          console.log('Loading puzzle from localStorage');
          var noteObj = JSON.parse(localStorage.getItem(this.savegame_name + "_notes"));
          if (noteObj && noteObj.length > 0) {
            for (var entry of noteObj) {
              this.notes.set(entry.key, entry.value);
            }
          }
          this.jsxw.cells = jsxw2_cells;
          puzzle.cells = jsxw2_cells;
        }

        // metadata
        this.title = puzzle.metadata.title || '';
        this.author = puzzle.metadata.author || '';
        this.copyright = puzzle.metadata.copyright || '';
        this.crossword_type = puzzle.metadata.crossword_type;
        this.fakeclues = puzzle.metadata.fakeclues || false;

        // don't show the top text if fakeclues
        if (this.fakeclues) {
          $('div.cw-top-text-wrapper').css({ display: 'none' });
        }

        // Change document title if necessary
        if (this.title) {
          document.title = this.title + ' | ' + document.title;
        }

        // determine whether we should autofill
        if (
          this.crossword_type == 'acrostic' ||
          this.crossword_type == 'coded'
        ) {
          this.is_autofill = true;
        }

        this.notepad = puzzle.metadata.description || '';
        this.grid_width = puzzle.metadata.width;
        this.grid_height = puzzle.metadata.height;

        // disable check and reveal in certain cases
        //if (puzzle.metadata.has_reveal === false) {
        //  this.has_reveal = false;
        //  $('.cw-reveal').css({ display: 'none' });
        //}
        //if (puzzle.metadata.has_check === false) {
        //  this.has_check = false;
        //  $('.cw-check').css({ display: 'none' });
        //}
        /* cells */
        this.cells = {};
        for (var i = 0; i < puzzle.cells.length; i++) {
          var c = { ...puzzle.cells[i] }; // make a copy
          c.x = c.x + 1;
          c.y = c.y + 1;
          if (!this.cells[c.x]) {
            this.cells[c.x] = {};
          }
          c.empty = (c.type === 'block' || c.type === 'void' || c.type === 'clue');
          c.clue = (c.type === 'clue');
          c.bar = {
            top: c['top-bar'] === true,
            bottom: c['bottom-bar'] === true,
            left: c['left-bar'] === true,
            right: c['right-bar'] === true,
          };
          c.color = c['background-color'];
          // if they tried to define a color but did it badly, use the default
          if (c.color && !c.color.match('^#[A-Za-z0-9]{6}$')) {
            c.color = this.default_background_color;
            c['background-color'] = this.default_background_color;
          }
          c.shape = c['background-shape'];

          /* set a "shade_highlight" color */
          if (c.color && c.color != this.config.color_none) {
            //c.shade_highlight_color = averageColors(this.config.color_word, c.color);
            c.shade_highlight_color = averageColors(this.config.color_word, adjustColor(c.color, -50));
            //c.shade_highlight_color = adjustColor(c.color, -30);
          }

          this.cells[c.x][c.y] = c;

          // maintain the mapping of number -> cells
          if (!this.number_to_cells[c.number]) {
            this.number_to_cells[c.number] = [c];
          } else {
            this.number_to_cells[c.number].push(c);
          }
        }

        // helper function for coded and fakeclues puzzles
        this.make_fake_clues = function (puzzle) {
          // initialize the across and down groups
          var clueMapping = {};
          var across_group = new CluesGroup(this, {
            id: CLUES_TOP,
            title: 'ACROSS',
            clues: [],
            words_ids: [],
          });
          var down_group = new CluesGroup(this, {
            id: CLUES_BOTTOM,
            title: 'DOWN',
            clues: [],
            words_ids: [],
          });
          // Determine which word is an across and which is a down
          // We do this by comparing the entry to the set of across entries
          var thisGrid = new xwGrid(puzzle.cells);
          var acrossEntries = thisGrid.acrossEntries();
          var acrossSet = new Set(Object.keys(acrossEntries).map(function (x) { return acrossEntries[x].word; }))
          var entry_mapping = puzzle.get_entry_mapping();
          Object.keys(entry_mapping).forEach(function (id) {
            var thisClue = { word: id, number: id, text: '--' };
            var entry = entry_mapping[id];
            if (acrossSet.has(entry)) {
              across_group.clues.push(thisClue);
              across_group.words_ids.push(id);
              clueMapping[id] = thisClue;
            } else {
              down_group.clues.push(thisClue);
              down_group.words_ids.push(id);
              clueMapping[id] = thisClue;
            }
          });
          return { 'across_group': across_group, 'down_group': down_group, 'clue_mapping': clueMapping };
        }

        /* clues */
        var clueMapping = {};
        // we handle them differently for coded crosswords
        if (this.crossword_type === 'coded') {
          var fake_clue_obj = this.make_fake_clues(puzzle);
          this.clues_top = fake_clue_obj.across_group;
          this.clues_bottom = fake_clue_obj.down_group;
          clueMapping = fake_clue_obj.clue_mapping;

          // Also, in a coded crossword, there's no reason to show the clues
          $('div.cw-clues-holder').css({ display: 'none' });
          $('div.cw-top-text-wrapper').css({ display: 'none' });
          // Add some padding to the buttons holder
          $('div.cw-buttons-holder').css({ padding: '0 10px' });

        } else { // not a coded crossword
          // we need to keep a mapping of word ID to clue
          puzzle.clues[0].clue.forEach(function (clue) {
            clueMapping[clue.word] = clue;
          });
          var words_ids_top = puzzle.clues[0].clue.map(function (key) {
            return key.word;
          });
          this.clues_top = new CluesGroup(this, {
            id: CLUES_TOP,
            title: puzzle.clues[0]['title'],
            clues: puzzle.clues[0].clue,
            words_ids: words_ids_top
          });
          // only do a second clue list if we have one
          if (puzzle.clues.length > 1) {
            puzzle.clues[1].clue.forEach(function (clue) {
              clueMapping[clue.word] = clue;
            });
            this.clues_bottom = new CluesGroup(this, {
              id: CLUES_BOTTOM,
              title: puzzle.clues[1]['title'],
              clues: puzzle.clues[1].clue,
              words_ids: puzzle.clues[1].clue.map(function (key) {
                return key.word;
              })
            });
          } else {
            // hide the bottom clues
            $('div.cw-clues-bottom').css({
              display: 'none',
            });
          }
        }

        // If "fakeclues" and the number of words and clues don't match
        // we need to make special "display" clues
        var num_words = puzzle.words.length;
        var num_clues = puzzle.clues.map(x => x.clue).flat().length;
        if (this.fakeclues && num_words != num_clues) {
          this.display_clues_top = this.clues_top;
          this.display_clues_bottom = this.clues_bottom;
          var fake_clue_obj = this.make_fake_clues(puzzle);
          this.clues_top = fake_clue_obj.across_group;
          this.clues_bottom = fake_clue_obj.down_group;
          clueMapping = fake_clue_obj.clue_mapping;
        }

        /* words */
        this.words = {};
        for (var i = 0; i < puzzle.words.length; i++) {
          var word = puzzle.words[i];
          this.words[word.id] = new Word(this, {
            id: word.id,
            dir: word.dir,
            refs_raw: null,
            cell_ranges: word.cells.map(function (c) {
              var obj = { x: (c[0] + 1).toString(), y: (c[1] + 1).toString() };
              return obj;
            }),
            clue: clueMapping[word.id]
          });
        }
        console.log(this);

        this.completeLoad();
        this.loadSavedTheme();
      }

      completeLoad() {
        $('#cw-title').text(this.title || 'Untitled Puzzle');
        $('#cw-author').text(this.author ? `${this.author}` : '');

        this.notepad_icon = this.root.find('.cw-button-notepad');

        this.changeActiveClues();
        if (this.display_clues_top || this.clues_top) {
          this.renderClues(this.display_clues_top || this.clues_top, this.clues_top_container);
        }
        if (this.display_clues_bottom || this.clues_bottom) {
          this.renderClues(this.display_clues_bottom || this.clues_bottom, this.clues_bottom_container);
        }
        this.addListeners();

        this.root.removeClass('loading');
        this.root.addClass('loaded');

        var first_word = this.active_clues.getFirstWord();
        this.setActiveWord(first_word);
        this.setActiveCell(first_word.getFirstCell());

        // Start the timer if necessary
        if (this.config.timer_autostart) {
          this.toggleTimer();
        }

        //this.adjustPaddings();
        this.canvas_holder.css('min-height', '300px');

        setTimeout(() => {
          this.renderCells();
          this.syncTopTextWidth();
        }, 200);
      }

      remove() {
        this.removeListeners();
        this.root.remove();
      }

      removeGlobalListeners() {
        $(window).off('click', this.handleClickWindow);
        $(window).off('resize', this.windowResized);
      }

      removeListeners() {
        this.removeGlobalListeners();
        this.root.undelegate();
        this.clues_holder.undelegate('div.cw-clues-items span');
        this.svg.off('mousemove click');

        this.reveal_letter.off('click');
        this.reveal_word.off('click');
        this.reveal_puzzle.off('click');

        this.check_letter.off('click');
        this.check_word.off('click');
        this.check_puzzle.off('click');

        // EDIT TO ADD THEME
        this.theme_barbie.off('click')
        this.theme_dark.off('click')
        this.theme_pumpkin_spice.off('click')
        this.theme_light_green.off('click')
        this.theme_light_blue.off('click')
        this.theme_light_blue_pink.off('click')
        this.theme_taco_bell.off('click')
        this.theme_earth_tones.off('click')
        this.theme_grape_soda.off('click')
        this.theme_cherry_blossom.off('click')
        this.theme_momos_nail_corner.off('click')
        this.theme_frost.off('click')
        this.theme_cryptic_crossweird.off('click')
        this.theme_spring_pastels.off('click')

        this.print_btn.off('click');
        this.clear_btn.off('click');
        this.load_btn.off('click');
        this.save_btn.off('click');
        this.download_btn.off('click');
        this.timer_button.off('click');

        this.settings_btn.off('click');

        this.info_btn.off('click');
        this.notepad_btn.off('click');
        this.notepad_icon.off('click');

        this.hidden_input.off('input');
        this.hidden_input.off('keydown');
      }

      addListeners() {
        $(window).on('click', this.handleClickWindow);
        $(window).on('resize', this.windowResized);

        this.root.delegate(
          '.cw-menu-container > button',
          'click',
          $.proxy(this.handleClickOpenMenu, this)
        );

        this.clues_holder.delegate(
          'div.cw-clues-items div.cw-clue',
          'mouseenter',
          $.proxy(this.mouseEnteredClue, this)
        );
        this.clues_holder.delegate(
          'div.cw-clues-items div.cw-clue',
          'mouseleave',
          $.proxy(this.mouseLeftClue, this)
        );
        this.clues_holder.delegate(
          'div.cw-clues-items div.cw-clue',
          'click',
          $.proxy(this.clueClicked, this)
        );

        if (this.config.hover_enabled) {
          this.svg.on('mousemove', $.proxy(this.mouseMoved, this));
        }
        this.svg.on('click', $.proxy(this.mouseClicked, this));

        // REVEAL
        this.reveal_letter.on(
          'click',
          $.proxy(this.check_reveal, this, 'letter', 'reveal')
        );
        this.reveal_word.on(
          'click',
          $.proxy(this.check_reveal, this, 'word', 'reveal')
        );
        this.reveal_puzzle.on(
          'click',
          $.proxy(this.check_reveal, this, 'puzzle', 'reveal')
        );

        // CHECK
        this.check_letter.on(
          'click',
          $.proxy(this.check_reveal, this, 'letter', 'check')
        );
        this.check_word.on(
          'click',
          $.proxy(this.check_reveal, this, 'word', 'check')
        );
        this.check_puzzle.on(
          'click',
          $.proxy(this.check_reveal, this, 'puzzle', 'check')
        );

        //EDIT TO ADD THEME
        this.theme_light_blue.on(
          'click',
          $.proxy(this.set_theme, this, 'light-blue-theme')
        );

        this.theme_light_green.on(
          'click',
          $.proxy(this.set_theme, this, 'light-green-theme')
        );

        this.theme_dark.on(
          'click',
          $.proxy(this.set_theme, this, 'dark-theme')
        );

        this.theme_pumpkin_spice.on(
          'click',
          $.proxy(this.set_theme, this, 'pumpkin-spice-theme')
        );

        this.theme_barbie.on(
          'click',
          $.proxy(this.set_theme, this, 'barbie-theme')
        );

        this.theme_taco_bell.on(
          'click',
          $.proxy(this.set_theme, this, 'taco-bell-theme')
        );

        this.theme_earth_tones.on(
          'click',
          $.proxy(this.set_theme, this, 'earth-tones-theme')
        );

        this.theme_grape_soda.on(
          'click',
          $.proxy(this.set_theme, this, 'grape-soda-theme')
        );

        this.theme_cherry_blossom.on(
          'click',
          $.proxy(this.set_theme, this, 'cherry-blossom-theme')
        );
        this.theme_momos_nail_corner.on(
          'click',
          $.proxy(this.set_theme, this, 'momos-nail-corner-theme')
        );
        this.theme_frost.on(
          'click',
          $.proxy(this.set_theme, this, 'frost-theme')
        );
        this.theme_cryptic_crossweird.on(
          'click',
          $.proxy(this.set_theme, this, 'cryptic-crossweird-theme')
        );
        this.theme_spring_pastels.on(
          'click',
          $.proxy(this.set_theme, this, 'spring-pastels-theme')
        );

        // PREVIEW THEME ON HOVER
        const previewTheme = (themeClass) => {
          const root = document.querySelector('.crossword');

          // Remove all other theme classes before adding the new one
          const allThemeClasses = [
            'dark-theme',
            'earth-tones-theme',
            'pumpkin-spice-theme',
            'light-green-theme',
            'light-blue-theme',
            'barbie-theme',
            'taco-bell-theme',
            'grape-soda-theme',
            'cherry-blossom-theme',
            'momos-nail-corner-theme',
            'frost-theme',
            'cryptic-crossweird-theme',
            'spring-pastels-theme'
          ];
          allThemeClasses.forEach(cls => root.classList.remove(cls));

          root.classList.add(themeClass);
          this.preview_theme = themeClass;

          // TEMP CONFIG PREVIEW VALUES
          const tempConfig = {
            'dark-theme': {
              color_selected: '#322533',
              color_word: '#534A54',
              color_block: '#212121',
              color_none: '#3F4D59',
              color_hilite: '#322533',
              font_color_fill: '#FFFFFF',
              font_color_clue: '#FFFFFF'
            },
            'pumpkin-spice-theme': {
              color_selected: '#9e2a2b',
              color_word: '#E3AF7B',
              color_block: '#212121',
              color_none: '#FFFFFF',
              color_hilite: '#E3AF7B',
              font_color_fill: '#000000',
              font_color_clue: '#000000'
            },
            'earth-tones-theme': {
              color_selected: '#754E42',
              color_word: '#F7DFD0',
              color_block: '#212121',
              color_none: '#FFFFFF',
              color_hilite: '#F7DFD0',
              font_color_fill: '#000000',
              font_color_clue: '#000000'
            },
            'light-green-theme': {
              color_selected: '#9DB08F',
              color_word: '#EFF5E9',
              color_block: '#212121',
              color_none: '#FFFFFF',
              color_hilite: '#9DB08F',
              font_color_fill: '#000000',
              font_color_clue: '#000000'
            },
            'light-blue-theme': {
              color_selected: '#506E85',
              color_word: '#D7E9F5',
              color_block: '#212121',
              color_none: '#FFFFFF',
              color_hilite: '#506E85',
              font_color_fill: '#000000',
              font_color_clue: '#000000'
            },
            'barbie-theme': {
              color_selected: '#56D6FC',
              color_word: '#FFCFE4',
              color_block: '#212121',
              color_none: '#FFE8F2',
              color_hilite: '#56D6FC',
              font_color_fill: '#000000',
              font_color_clue: '#000000'
            },
            'taco-bell-theme': {
              color_selected: '#289E94',
              color_word: '#3DF2E3',
              color_block: '#502859',
              color_none: '#FFD4E6',
              color_hilite: '#289E94',
              font_color_fill: '#000000',
              font_color_clue: '#000000'
            },
            'grape-soda-theme': {
              color_selected: '#7976a4',
              color_word: '#dfdfea',
              color_block: '#2b256f',
              color_none: '#FFFFFF',
              color_hilite: '#289E94',
              font_color_fill: '#000000',
              font_color_clue: '#000000'
            },
            'cherry-blossom-theme': {
              color_selected: '#F25477',
              color_word: '#FFDCDC',
              color_block: '#212121',
              color_none: '#FFFFFF',
              color_hilite: '#506E85',
              font_color_fill: '#000000',
              font_color_clue: '#000000'
            },
            'momos-nail-corner-theme': {
              color_selected: '#98fdff',
              color_word: '#d3feff',
              color_block: '#abc837',
              color_none: '#edf9c3',
              color_hilite: '#289e94',
              font_color_fill: '#000000',
              font_color_clue: '#000000'
            },
            'frost-theme': {
              color_selected: '#b0bef7',
              color_word: '#e6eafc',
              color_block: '#212121',
              color_none: '#ffffff',
              color_hilite: '#289e94',
              font_color_fill: '#000000',
              font_color_clue: '#000000'
            },
            'cryptic-crossweird-theme': {
              color_selected: '#da854a',
              color_word: '#eabc9b',
              color_block: '#212121',
              color_none: '#ffffff',
              color_hilite: '#289e94',
              font_color_fill: '#000000',
              font_color_clue: '#000000'
            },
            'spring-pastels-theme': {
              color_selected: '#e3addd',
              color_word: '#f7e8f5',
              color_block: '#212121',
              color_none: '#ffffff',
              color_hilite: '#289e94',
              font_color_fill: '#000000',
              font_color_clue: '#000000'
            }
          };

          const previewSettings = tempConfig[themeClass];
          if (previewSettings) {
            for (const [key, value] of Object.entries(previewSettings)) {
              this.config[key] = value;
            }
          }

          this.renderCells();
        };

        const revertTheme = () => {
          const root = document.querySelector('.crossword');
          const currentTheme = this.appliedThemeClass;

          if (this.preview_theme && this.preview_theme !== currentTheme) {
            root.classList.remove(this.preview_theme);
            if (currentTheme) root.classList.add(currentTheme);
            this.set_theme(currentTheme); // restores config too
            this.renderCells();
          }

          this.preview_theme = null;
        };

        this.root.find('.cw-theme .cw-menu-item').each((_, el) => {
          const themeClass = el.className
            .split(' ')
            .find(cls => cls.startsWith('cw-theme-'))
            .replace('cw-theme-', '') + '-theme';

          el.addEventListener('mouseenter', () => previewTheme(themeClass));
          el.addEventListener('mouseleave', () => revertTheme());
        });


        // PRINTER
        this.print_btn.on('click', $.proxy(this.printPuzzle, this));

        // CLEAR
        this.clear_btn.on(
          'click',
          $.proxy(this.check_reveal, this, 'puzzle', 'clear')
        );

        // DOWNLOAD
        this.download_btn.on('click', $.proxy(this.exportJPZ, this));

        /** We're disabling save and load buttons **/
        // SAVE
        //this.save_btn.on('click', $.proxy(this.saveGame, this));
        // LOAD
        //this.load_btn.on('click', $.proxy(this.loadGame, this));

        // TIMER
        this.timer_button.on('click', $.proxy(this.toggleTimer, this));
        // SETTINGS
        this.settings_btn.on('click', $.proxy(this.openSettings, this));

        // INFO
        this.info_btn.on('click', $.proxy(this.showInfo, this));

        // PREV/NEXT BUTTONS FOR MOBILE
        this.root.find('.cw-button-prev-clue').on('click', () => {
          this.moveToNextWord(true, this.config.tab_key === 'tab_skip');
          this.hidden_input.focus();
        });
        this.root.find('.cw-button-next-clue').on('click', () => {
          this.moveToNextWord(false, this.config.tab_key === 'tab_skip');
          this.hidden_input.focus();
        });

        // NOTEPAD
        if (this.notepad) {
          this.notepad_icon.on('click', $.proxy(this.showNotepad, this));
          this.notepad_btn.show();
        } else {
          this.notepad_icon.hide();
        }
        this.notepad_btn.on('click', $.proxy(this.showNotepad, this));

        this.hidden_input.on(
          'input',
          $.proxy(this.hiddenInputChanged, this, null)
        );
        this.hidden_input.on('keydown', $.proxy(this.keyPressed, this));

        this.svgContainer.addEventListener('click', (e) => {
          if (e.target.tagName === 'rect') {
            const x = parseInt(e.target.getAttribute('data-x'));
            const y = parseInt(e.target.getAttribute('data-y'));
            const clickedCell = this.getCell(x, y);

            if (!clickedCell.empty) {
              const newActiveWord = this.active_clues.getMatchingWord(x, y, true)
                                    || this.inactive_clues.getMatchingWord(x, y, true);

              if (newActiveWord) {
                this.setActiveWord(newActiveWord);
                this.setActiveCell(clickedCell);
                this.renderCells();
              }
            }
          }
        });

        this.svgContainer.addEventListener('dblclick', (e) => {
          if (e.target.tagName === 'rect') {
            const x = parseInt(e.target.getAttribute('data-x'));
            const y = parseInt(e.target.getAttribute('data-y'));
            const clickedCell = this.getCell(x, y);

            if (
              !clickedCell.empty &&
              this.selected_cell &&
              this.selected_cell.x === x &&
              this.selected_cell.y === y
            ) {
              this.changeActiveClues(); // toggle direction
              this.renderCells(); // optionally re-render after direction switch
            }
          }
        });

      }

      handleClickWindow(event) {
        this.root.find('.cw-menu').removeClass('open');
      }

      handleClickOpenMenu(event) {
          const menuContainer = $(event.target).closest('.cw-menu-container');
          const menu = menuContainer.find('.cw-menu');
          const isAlreadyOpen = menu.hasClass('open');

          // Close all dropdowns first
          this.root.find('.cw-menu').removeClass('open');

          // If it wasn't already open, open this one
          if (!isAlreadyOpen) {
            setTimeout(() => {
              menu.addClass('open');
            });
          }
      }


      // Create a generic modal box with content
      createModalBox(title, content, button_text = 'Close') {
        // Set the contents of the modal box
        const modalContent = `
        <div class="modal-content">
          <div class="modal-header">
            <span class="modal-close">&times;</span>
            <span class="modal-title">${title}</span>
          </div>
          <div class="modal-body">
            ${content}
          </div>
          <div class="modal-footer">
            <button class="cw-button" id="modal-button">${button_text}</button>
          </div>
        </div>`;
        // Set this to be the contents of the container modal div
        this.root.find('.cw-modal').html(modalContent);

        // Show the div
        var modal = this.root.find('.cw-modal').get(0);
        modal.style.display = 'block';

        // Allow user to close the div
        const this_hidden_input = this.hidden_input;
        var span = this.root.find('.modal-close').get(0);
        // When the user clicks on <span> (x), close the modal
        span.onclick = function () {
          modal.style.display = 'none';
          if (!isMobile) {
            this_hidden_input.focus();
          }
        };
        // When the user clicks anywhere outside of the modal, close it
        window.onclick = function (event) {
          if (event.target == modal) {
            modal.style.display = 'none';
            if (!isMobile) {
              this_hidden_input.focus();
            }
          }
        };
        // Clicking the button should close the modal
        var modalButton = document.getElementById('modal-button');
        modalButton.onclick = function () {
          modal.style.display = 'none';
          if (!isMobile) {
            this_hidden_input.focus();
          }
        };
      }

      setConfig(name, value) {
        this.config[name] = value;
        console.log("name =" + name + ', value = ' + value);
      }

      // Function to switch the clues, generally from "ACROSS" to "DOWN"
      changeActiveClues() {
        if (!this.clues_bottom) {
          // only one clue list
          this.active_clues = this.clues_top;
          this.inactive_clues = this.clues_top;
          if (this.selected_cell) {
            var new_word = this.active_clues.getMatchingWord(
              this.selected_cell.x,
              this.selected_cell.y,
              true
            );
            this.setActiveWord(new_word);
          }
        } else if (this.active_clues && this.active_clues.id === CLUES_TOP) {
          if (this.inactive_clues !== null) {
            this.active_clues = this.clues_bottom;
            this.inactive_clues = this.clues_top;
          }
        } else {
          // active is the bottom
          this.active_clues = this.clues_top;
          this.inactive_clues = this.clues_bottom;
        }
      }

      getCell(x, y) {
        return this.cells[x] ? this.cells[x][y] : null;
      }

      setActiveWord(word) {
        if (word) {
          this.selected_word = word;
          if (this.fakeclues) {
            return;
          }
          this.top_text.html(`
            <span class="cw-clue-number">
              ${escape(word.clue.number)}
            </span>
            <span class="cw-clue-text">
              ${escape(word.clue.text)}
            </span>
          `);
          resizeText(this.root, this.top_text);
        }
      }

      setActiveCell(cell) {
        var offset = this.svg.offset(),
          input_top,
          input_left;
        if (cell && !cell.empty) {
          this.selected_cell = cell;
          this.inactive_clues.markActive(cell.x, cell.y, true, this.fakeclues);
          this.active_clues.markActive(cell.x, cell.y, false, this.fakeclues);

          input_top = offset.top + (cell.y - 1) * this.cell_size;
          input_left = offset.left + (cell.x - 1) * this.cell_size;

          this.hidden_input.css({ left: input_left, top: input_top });
          if (!isMobile) {
            this.hidden_input.focus();
          }
          this.renderCells();
        }
      }

      renderClues(clues_group, clues_container) {
        var i,
          clue,
          clue_el,
          title = clues_container.find('div.cw-clues-title'),
          items = clues_container.find('div.cw-clues-items');
        let notes = this.notes;
        items.find('div.cw-clue').remove();
        for (i = 0; (clue = clues_group.clues[i]); i++) {
          clue_el = $(`
            <div style="position: relative">
              <span class="cw-clue-number">
                ${escape(clue.number)}
              </span>
              <span class="cw-clue-text">
                ${escape(clue.text)}
                <div class="cw-edit-container" style="display: none;">
                <input class="cw-input note-style" type="text">
              </div>
              <span class="cw-cluenote-button" style="display: none;" />
              </span>
                  </div>
          `);
          // if there's any saved notes add them to their section
          let clueNote = notes.get(clue.word);
          if (clueNote !== undefined) {
            clue_el.find('.cw-input').val(clueNote);
            clue_el.find('.cw-edit-container').show();
          }

          clue_el.data('word', clue.word);
          clue_el.data('number', clue.number);
          clue_el.data('clues', clues_group.id);
          clue_el.addClass('cw-clue');
          clue_el.addClass('word-' + clue.word);
          items.append(clue_el);
        }
        title.html(escape(clues_group.title));
        clues_group.clues_container = items;

        // Add event listeners for editing
        items.find('.cw-clue').on('mouseenter', function () {
          var clueElement = $(this).closest('.cw-clue');
          if (clueElement.find('.cw-input').val().trim().length === 0) {
            $(this).find('.cw-cluenote-button').show();
          }
        });

        items.find('.cw-clue').on('mouseleave', function () {
          $(this).find('.cw-cluenote-button').hide();
        });

        items.find('.cw-input').on('click', function (event) {
          event.stopPropagation();
        });

        var save = () => this.saveGame();

        items.find('.cw-cluenote-button').on('click', function (event) {
          event.stopPropagation();
          var clueElement = $(this).closest('.cw-clue');
          clueElement.find('.cw-edit-container').show();
          clueElement.find('.cw-input').focus();
          $(this).hide();
        });

        items.find('.cw-input').on('blur', function () {
          var clueElement = $(this).closest('.cw-clue');
          var newText = clueElement.find('.cw-input').val().trim();
          if (newText.length > 0) {
            notes.set(clueElement.data('word'), newText);
          } else {
            clueElement.find('.cw-edit-container').hide();
            notes.delete(clueElement.data('word'));
          }
          save()
        });

        items.find('.cw-input').on('keydown', function (event) {
          if (event.keyCode === 13) { // Enter key
            var clueElement = $(this).closest('.cw-clue');
            clueElement.find('.cw-input').blur();
          }
        });
      }

      // Clears canvas and re-renders all cells
      renderCells() {
        // Responsive SVG sizing
        const canvasRect = this.canvas_holder.get(0).getBoundingClientRect();
        const svgTopMargin = getComputedStyle(this.svgContainer).marginTop;
        const maxHeight = canvasRect.height - parseInt(svgTopMargin, 10);
        const maxWidth = canvasRect.width;

        this.cell_size = Math.floor(
          Math.min(
            maxWidth / this.grid_width,
            maxHeight / this.grid_height
          )
        );

        const svgWidth = this.grid_width * this.cell_size;
        const svgHeight = this.grid_height * this.cell_size;

        this.svgContainer.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`);
        this.svgContainer.setAttribute('width', svgWidth);
        this.svgContainer.setAttribute('height', svgHeight);

        if (this.toptext && this.toptext[0]) {
          this.toptext[0].style.width = svgWidth + 'px';
        }

        const SIZE = this.cell_size;
        const svg = this.svgContainer;
        svg.innerHTML = ''; // Clear SVG grid before redrawing

        const padding = 1;
        svg.setAttribute(
          'viewBox',
          `-${padding} -${padding} ${this.grid_width * SIZE + padding * 2} ${this.grid_height * SIZE + padding * 2}`
        );

        for (let x in this.cells) {
          for (let y in this.cells[x]) {
            const cell = this.cells[x][y];
            const shouldRender =
              !cell.empty || cell.clue === true || cell.type === 'block';

            if (!shouldRender) continue;

            const cellX = (x - 1) * SIZE;
            const cellY = (y - 1) * SIZE;

            const rect = document.createElementNS(this.svgNS, 'rect');
            rect.setAttribute('x', cellX);
            rect.setAttribute('y', cellY);
            rect.setAttribute('width', SIZE);
            rect.setAttribute('height', SIZE);
            rect.setAttribute('stroke', '#212121');
            rect.setAttribute('data-x', cell.x);
            rect.setAttribute('data-y', cell.y);
            rect.setAttribute('class', 'cw-cell');

            let fillColor = cell.type === 'block' ? this.config.color_block : this.config.color_none;
            if (this.selected_cell && cell.x === this.selected_cell.x && cell.y === this.selected_cell.y) {
              fillColor = this.config.color_selected;
              rect.classList.add('selected');
            } else if (this.selected_word && this.selected_word.hasCell(cell.x, cell.y)) {
              fillColor = this.config.color_word;
            } else if (cell.color) {
              fillColor = cell.color;
            }

            rect.setAttribute('fill', fillColor);
            svg.appendChild(rect);

            if (cell.shape === 'circle') {
              const circle = document.createElementNS(this.svgNS, 'circle');
              circle.setAttribute('cx', cellX + SIZE / 2);
              circle.setAttribute('cy', cellY + SIZE / 2);

              // Slightly bigger than cell, so edges are clipped
              const inset = 0.3; // lower is bigger
              const radius = SIZE / 2 + inset;

              circle.setAttribute('r', radius);
              circle.setAttribute('fill', 'none');
              circle.setAttribute('stroke', this.config.color_block || '#212121');
              circle.setAttribute('stroke-width', 1.1);
              circle.setAttribute('pointer-events', 'none');
              svg.appendChild(circle);
            }

            if (cell.bar) {
              const barWidth = this.config.bar_linewidth;
              const barColor = '#212121';
              const halfBar = barWidth / 2;

              const barStart = {
                top: [cellX, cellY + halfBar],
                left: [cellX + halfBar, cellY],
                right: [cellX + SIZE - halfBar, cellY + SIZE],
                bottom: [cellX + SIZE, cellY + SIZE - halfBar],
              };

              const barEnd = {
                top: [cellX + SIZE, cellY + halfBar],
                left: [cellX + halfBar, cellY + SIZE],
                right: [cellX + SIZE - halfBar, cellY],
                bottom: [cellX, cellY + SIZE - halfBar],
              };

              for (const side in cell.bar) {
                if (cell.bar[side]) {
                  const [x1, y1] = barStart[side];
                  const [x2, y2] = barEnd[side];
                  const barLine = document.createElementNS(this.svgNS, 'line');
                  barLine.setAttribute('x1', x1);
                  barLine.setAttribute('y1', y1);
                  barLine.setAttribute('x2', x2);
                  barLine.setAttribute('y2', y2);
                  barLine.setAttribute('stroke', barColor);
                  barLine.setAttribute('stroke-width', barWidth);
                  barLine.setAttribute('stroke-linecap', 'square');
                  barLine.setAttribute('pointer-events', 'none');
                  svg.appendChild(barLine);
                }
              }
            }

            if (cell.letter) {
              const text = document.createElementNS(this.svgNS, 'text');
              text.setAttribute('x', cellX + SIZE / 2);
              text.setAttribute('y', cellY + SIZE * 0.77);
              text.setAttribute('text-anchor', 'middle');
              const letterLength = cell.letter.length;
              const scale = letterLength <= 2 ? 0.6 : letterLength === 3 ? 0.45 : 0.35;
              text.setAttribute('font-size', `${SIZE * scale}px`);
              text.setAttribute('font-family', 'Arial, sans-serif');
              text.setAttribute('font-weight', 'bold');
              text.textContent = cell.letter;
              text.classList.add('cw-cell-letter');
              text.setAttribute('fill', this.config.font_color_fill);
              svg.appendChild(text);

              if (cell.checked) {
                const slash = document.createElementNS(this.svgNS, 'line');
                slash.setAttribute('x1', cellX + 2);
                slash.setAttribute('y1', cellY + 2);
                slash.setAttribute('x2', cellX + SIZE - 2);
                slash.setAttribute('y2', cellY + SIZE - 2);
                slash.setAttribute('stroke', '#000');
                slash.setAttribute('stroke-width', 2);
                slash.setAttribute('stroke-linecap', 'round');
                svg.appendChild(slash);
              }
            }

            if (cell.number) {
              const number = document.createElementNS(this.svgNS, 'text');
              number.setAttribute('x', cellX + SIZE * 0.1);
              number.setAttribute('y', cellY + SIZE * 0.3);
              number.setAttribute('font-size', `${SIZE / 3.75}px`);
              number.setAttribute('font-family', 'Arial, sans-serif');
              number.textContent = cell.number;
              number.setAttribute('fill', this.config.font_color_clue);
              number.classList.add('cw-cell-number');
              svg.appendChild(number);
            }
          }
        }

        this.drawSelectedWordBorder(svg, this.selected_word);
        setTimeout(() => this.syncTopTextWidth(), 0);

        for (const wordId in this.words) {
          this.updateClueAppearance(this.words[wordId]);
        }
      }

      drawSelectedWordBorder(svg, word) {
          if (!word || !word.cells.length) return;

          const SIZE = this.cell_size;

          let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1;

          for (const coord of word.cells) {
            const [x, y] = coord.split('-').map(Number);
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
          }

          const rect = document.createElementNS(this.svgNS, 'rect');
          rect.setAttribute('x', (minX - 1) * SIZE);
          rect.setAttribute('y', (minY - 1) * SIZE);
          rect.setAttribute('width', (maxX - minX + 1) * SIZE);
          rect.setAttribute('height', (maxY - minY + 1) * SIZE);
          rect.setAttribute('fill', 'none');
          rect.setAttribute('stroke', this.config.color_selected);
          rect.setAttribute('stroke-width', 1.5);
          rect.setAttribute('pointer-events', 'none');
          rect.setAttribute('class', 'selected-word-border');
          svg.appendChild(rect);
        }

      mouseMoved(e) {
        if (this.config.hover_enabled) {
          var offset = this.svg.offset(),
            mouse_x = e.pageX - offset.left,
            mouse_y = e.pageY - offset.top,
            index_x = Math.ceil(mouse_x / this.cell_size),
            index_y = Math.ceil(mouse_y / this.cell_size);

          if (index_x !== this.hovered_x || index_y !== this.hovered_y) {
            this.hovered_x = index_x;
            this.hovered_y = index_y;
            this.renderCells();
          }
        }
      }

      mouseClicked(e) {
        var offset = this.svg.offset(),
          mouse_x = e.pageX - offset.left,
          mouse_y = e.pageY - offset.top,
          index_x = Math.ceil(mouse_x / this.cell_size),
          index_y = Math.ceil(mouse_y / this.cell_size);

        if (
          this.selected_cell &&
          this.selected_cell.x == index_x &&
          this.selected_cell.y == index_y
        ) {
          this.changeActiveClues();
        }

        if (this.active_clues.getMatchingWord(index_x, index_y, true)) {
          this.setActiveWord(
            this.active_clues.getMatchingWord(index_x, index_y, true)
          );
        } else {
          this.setActiveWord(
            this.inactive_clues.getMatchingWord(index_x, index_y, true)
          );
          this.changeActiveClues();
        }
        this.setActiveCell(this.getCell(index_x, index_y));
        this.renderCells();
      }

      keyPressed(e) {
        if (this.settings_open) {
          return;
        }

        // to prevent event propagation for specified keys
        var prevent =
          [35, 36, 37, 38, 39, 40, 32, 46, 8, 9, 13].indexOf(e.keyCode) >= 0;

        switch (e.keyCode) {
          case 35: // end
            this.moveToFirstCell(true);
            break;
          case 36: // home
            this.moveToFirstCell(false);
            break;
          case 37: // left
            if (e.shiftKey) {
              this.skipToWord(SKIP_LEFT);
            } else {
              this.moveSelectionBy(-1, 0);
            }
            break;
          case 38: // up
            if (e.shiftKey) {
              this.skipToWord(SKIP_UP);
            } else {
              this.moveSelectionBy(0, -1);
            }
            break;
          case 39: // right
            if (e.shiftKey) {
              this.skipToWord(SKIP_RIGHT);
            } else {
              this.moveSelectionBy(1, 0);
            }
            break;
          case 40: // down
            if (e.shiftKey) {
              this.skipToWord(SKIP_DOWN);
            } else {
              this.moveSelectionBy(0, 1);
              this.renderCells();
            }
            break;
          case 32: //space
            if (this.selected_cell && this.selected_word) {
              // change the behavior based on the config
              if (this.config.space_bar === 'space_switch') {
                // check that there is a word in the other direction
                // if there's not, we just don't do anything
                var selectedCellInactiveWord =
                  this.inactive_clues.getMatchingWord(
                    this.selected_cell.x,
                    this.selected_cell.y,
                    true
                  );
                if (selectedCellInactiveWord) {
                  this.changeActiveClues();
                  this.setActiveWord(selectedCellInactiveWord);
                  this.setActiveCell(this.getCell(this.selected_cell.x, this.selected_cell.y));
                }
              } else {
                this.selected_cell.letter = '';
                this.selected_cell.checked = false;
                this.autofill();
                var next_cell = this.selected_word.getNextCell(
                  this.selected_cell.x,
                  this.selected_cell.y
                );
                this.setActiveCell(next_cell);
              }
            }
            this.renderCells();
            // Update this.isSolved
            this.checkIfSolved();
            break;
          case 27: // escape -- pulls up a rebus entry
            if (e.shiftKey) {
              e.preventDefault();
              this.toggleTimer();
            } else {
              if (this.selected_cell && this.selected_word) {
                var rebus_entry = prompt('Rebus entry', '');
                this.hiddenInputChanged(rebus_entry);
              }
            }
            break;
          case 45: // insert -- same as escape
            if (this.selected_cell && this.selected_word) {
              var rebus_entry = prompt('Rebus entry', '');
              this.hiddenInputChanged(rebus_entry);
            }
            break;
          case 46: // delete
            if (this.selected_cell) {
              this.selected_cell.letter = '';
              this.selected_cell.checked = false;
              this.autofill();
            }
            this.renderCells();
            // Update this.isSolved
            this.checkIfSolved();
            break;
          case 8: // backspace
            if (this.selected_cell && this.selected_word) {
              this.selected_cell.letter = '';
              this.selected_cell.checked = false;
              this.autofill();
              var prev_cell = this.selected_word.getPreviousCell(
                this.selected_cell.x,
                this.selected_cell.y
              );
              this.setActiveCell(prev_cell);
            }
            this.renderCells();
            // Update this.isSolved
            this.checkIfSolved();
            break;
          case 9: // tab
            var skip_filled_words = this.config.tab_key === 'tab_skip';
            if (e.shiftKey) {
              this.moveToNextWord(true, skip_filled_words);
            } else {
              this.moveToNextWord(false, skip_filled_words);
            }
            break;
          case 13: // enter key -- same as tab
            var skip_filled_words = this.config.tab_key === 'tab_skip';
            if (e.shiftKey) {
              this.moveToNextWord(true, skip_filled_words);
            } else {
              this.moveToNextWord(false, skip_filled_words);
            }
            break;
        }
        if (prevent) {
          e.preventDefault();
          e.stopPropagation();
        }
      }

      autofill() {
        // save progress
        this.saveGame();
        if (this.is_autofill) {
          var my_number = this.selected_cell.number;
          var same_number_cells = this.number_to_cells[my_number] || [];
          for (var my_cell of same_number_cells) {
            var cell = this.cells[my_cell.x][my_cell.y];
            cell.letter = this.selected_cell.letter;
            cell.checked = this.selected_cell.checked;
          }
        }
      }

      // Detects user inputs to hidden input element
      hiddenInputChanged(rebus_string) {
        var mychar = this.hidden_input.val().slice(0, 1).toUpperCase(),
          next_cell;
        if (this.selected_word && this.selected_cell) {
          if (mychar) {
            this.selected_cell.letter = mychar;
          } else if (rebus_string) {
            this.selected_cell.letter = rebus_string.toUpperCase();
          }
          this.selected_cell.checked = false;

          // If this is a coded or acrostic
          // find all cells with this number
          // and fill them with the same letter
          this.autofill();

          // Within hiddenInputChanged():
          this.renderCells(); // Re-render SVG grid immediately after user input

          // find empty cell, then next cell
          // Change this depending on config
          if (this.config.skip_filled_letters) {
            next_cell =
              this.selected_word.getFirstEmptyCell(
                this.selected_cell.x,
                this.selected_cell.y
              ) ||
              this.selected_word.getNextCell(
                this.selected_cell.x,
                this.selected_cell.y
              );
          } else {
            next_cell = this.selected_word.getNextCell(
              this.selected_cell.x,
              this.selected_cell.y
            );
          }

          this.setActiveCell(next_cell);
          this.renderCells();
          this.checkIfSolved()
        }
        this.hidden_input.val('');
      }

      checkIfSolved(do_reveal = false) {
        var wasSolved = this.isSolved;
        var i, j, cell;
        for (i in this.cells) {
          for (j in this.cells[i]) {
            cell = this.cells[i][j];
            // if found cell without letter or with incorrect letter - return
            if (
              !cell.empty &&
              (!cell.letter || !isCorrect(cell.letter, cell.solution))
            ) {
              this.isSolved = false;
              return;
            }
          }
        }
        // Puzzle is solved!
        this.isSolved = true;
        // stop the timer
        var timerMessage = '';
        if (this.timer_running) {
          // prepare message based on time
          var display_seconds = xw_timer_seconds % 60;
          var display_minutes = (xw_timer_seconds - display_seconds) / 60;
          var minDisplay = display_minutes == 1 ? 'minute' : 'minutes';
          var secDisplay = display_seconds == 1 ? 'second' : 'seconds';
          var allMin = display_minutes > 0 ? `${display_minutes} ${minDisplay} ` : '';
          timerMessage = `<br /><br /><center>You finished in ${allMin} ${display_seconds} ${secDisplay}.</center>`;

          // stop the timer
          clearTimeout(xw_timer);
          this.timer_button.removeClass('running');
          this.timer_running = false;
        }
        // reveal all (in case there were rebuses)
        if (do_reveal) {
          this.check_reveal('puzzle', 'reveal');
        }

        setTimeout(() => {
          this.renderCells(); // Force fresh render
          const allLetters = this.svgContainer.querySelectorAll('.cw-cell-letter');

          allLetters.forEach((el, i) => {
            setTimeout(() => {
              el.classList.add('spin');
            }, i * 15);
          });
        }, 100); // give the DOM some time to settle


        confetti({
          particleCount: 280,
          spread: 190,
          origin: { y: 0.4 }
        });

       /* const winSound = new Audio('./sounds/hny.mp3');
          winSound.play();*/

        const successWrapper = document.getElementById("successAnimWrapper")
        const successAnim = document.getElementById("successAnim")
        function showSuccessAnim() {
          successWrapper.style.display = "flex";
          successWrapper.style.pointerEvents = "all";
          gsap.to(successAnim, {
            y: "0px",
            rotateY: "0deg",
            duration: 1,
            ease: "bounce.out",
            onComplete: () => { setTimeout(hideSuccessAnim, 500) }
          })
          gsap.to(successAnim, {
            opacity: 1,
            duration: 1,
            ease: "power3.out"
          })
        }
        function hideSuccessAnim() {
          gsap.to(successAnim, {
            y: "-40px",
            rotateY: "90deg",
            duration: 0.5,
            opacity: 0,
            ease: "power4.out",
            onComplete: () => { successWrapper.style.display = "none"; successWrapper.style.pointerEvents = "none"; showSuccessMsg() }
          })
        }
        const here = this
        function showSuccessMsg() {
          const rawMessage = here.msg_solved;

          // â›” If msg_solved is undefined, null, or an empty string, skip the message
          if (!rawMessage || rawMessage.trim() === '') return;

          let solvedMessage = escape(rawMessage).trim().replaceAll('\n', '<br />');
          solvedMessage += timerMessage;
          here.createModalBox('Puzzle solved!', solvedMessage);
        }


        // show completion message if newly solved
        if (!wasSolved) {
          showSuccessAnim()
        }
      }

      // callback for shift+arrows
      // finds next cell in specified direction that does not belongs to current word
      // then selects that word and selects its first empty || first cell
      skipToWord(direction) {
        if (this.selected_cell && this.selected_word) {
          var i,
            cell,
            word,
            word_cell,
            x = this.selected_cell.x,
            y = this.selected_cell.y;

          var cellFound = (cell) => {
            if (cell && !cell.empty) {
              word = this.active_clues.getMatchingWord(cell.x, cell.y);
              if (word && word.id !== this.selected_word.id) {
                word_cell = word.getFirstEmptyCell() || word.getFirstCell();
                this.setActiveWord(word);
                this.setActiveCell(word_cell);
                this.renderCells();
                this.renderCells();

                return true;
              }
            }
            return false;
          };

          switch (direction) {
            case SKIP_UP:
              for (i = y - 1; i >= 0; i--) {
                cell = this.getCell(x, i);
                if (cellFound(cell)) {
                  return;
                }
              }
              break;
            case SKIP_DOWN:
              for (i = y + 1; i <= this.grid_height; i++) {
                cell = this.getCell(x, i);
                if (cellFound(cell)) {
                  return;
                }
              }
              break;
            case SKIP_LEFT:
              for (i = x - 1; i >= 0; i--) {
                cell = this.getCell(i, y);
                if (cellFound(cell)) {
                  return;
                }
              }
              break;
            case SKIP_RIGHT:
              for (i = x + 1; i <= this.grid_width; i++) {
                cell = this.getCell(i, y);
                if (cellFound(cell)) {
                  return;
                }
              }
              break;
          }
        }
      }

      moveToNextWord(to_previous, skip_filled_words = false) {
        if (!this.selected_word) {
          return;
        }
        var next_word = null;
        var this_word = this.selected_word;
        //if (to_previous) {
        while (next_word !== this.selected_word) {
          next_word = (to_previous ? this.active_clues.getPreviousWord(this_word) : this.active_clues.getNextWord(this_word));
          if (!next_word) {
            this.changeActiveClues();
            next_word = (to_previous ? this.active_clues.getLastWord() : this.active_clues.getFirstWord());
          }
          if (!skip_filled_words || !next_word.isFilled()) {
            break;
          }
          this_word = next_word;
        }

        var cell;
        if (next_word) {
          cell = next_word.getFirstEmptyCell() || next_word.getFirstCell();
          this.setActiveWord(next_word);
          this.setActiveCell(cell);
          this.renderCells();
        }
      }

      moveToNextWord_OLD(to_previous) {
        if (this.selected_word) {
          var next_word = to_previous
            ? this.active_clues.getPreviousWord(this.selected_word)
            : this.active_clues.getNextWord(this.selected_word),
            cell;
          if (next_word) {
            cell = next_word.getFirstEmptyCell() || next_word.getFirstCell();
            this.setActiveWord(next_word);
            this.setActiveCell(cell);
            this.renderCells();
          }
        }
      }

      moveToFirstCell(to_last) {
        if (this.selected_word) {
          var cell = to_last
            ? this.selected_word.getLastCell()
            : this.selected_word.getFirstCell();
          if (cell) {
            this.setActiveCell(cell);
            this.renderCells();
          }
        }
      }

      // callback for arrow keys - moves selection by one cell
      // can change direction
      moveSelectionBy(delta_x, delta_y, jumping_over_black) {
        var x, y, new_cell;
        if (this.selected_cell) {
          x = this.selected_cell.x + delta_x;
          y = this.selected_cell.y + delta_y;
          new_cell = this.getCell(x, y);

          if (!new_cell) {
            /* If we can't find a new cell, we do nothing. */
            //this.changeActiveClues();
            return;
          }

          // try to jump over empty cell
          if (new_cell.empty) {
            if (delta_x < 0) {
              delta_x--;
            } else if (delta_x > 0) {
              delta_x++;
            } else if (delta_y < 0) {
              delta_y--;
            } else if (delta_y > 0) {
              delta_y++;
            }
            this.moveSelectionBy(delta_x, delta_y, true);
            return;
          }

          // If the new cell is not in the current word
          if (!this.selected_word.hasCell(x, y)) {
            // If the selected cell and the new cell are in the same word, we switch directions
            // We make sure that there is such a word as well (i.e. both are not null)
            var selectedCellInactiveWord = this.inactive_clues.getMatchingWord(
              this.selected_cell.x,
              this.selected_cell.y,
              true
            );
            var newCellInactiveWord = this.inactive_clues.getMatchingWord(
              new_cell.x,
              new_cell.y,
              true
            );
            if (selectedCellInactiveWord) {
              if (
                selectedCellInactiveWord.hasCell(new_cell.x, new_cell.y) &&
                newCellInactiveWord !== null
              ) {
                this.changeActiveClues();
                /*
                 * when do we keep the current cell selected? in two cases:
                 * (a) this.config.arrow_direction === 'arrow_stay'
                 * (b) arrow_direction is 'arrow_move_filled' and the current cell is empty
                 */
                if (this.config.arrow_direction === 'arrow_stay') {
                  new_cell = this.selected_cell;
                } else if (
                  !this.selected_cell.letter &&
                  this.config.arrow_direction === 'arrow_move_filled'
                ) {
                  new_cell = this.selected_cell;
                }
              }
            }
            // If the new cell does not have a word in the currently active direction,
            // we change the direction
            var newCellActiveWord = this.active_clues.getMatchingWord(
              new_cell.x,
              new_cell.y,
              true
            );
            if (!newCellActiveWord) {
              this.changeActiveClues();
            }
            // In any case we change the active word
            this.setActiveWord(
              this.active_clues.getMatchingWord(new_cell.x, new_cell.y)
            );
          }
          this.setActiveCell(new_cell);
          this.renderCells();
        }
      }

      windowResized() {
        setBreakpointClasses(this.root);
        resizeText(this.root, this.top_text);
        this.renderCells();
        this.syncTopTextWidth();
      }

      syncTopTextWidth() {
          const svg = this.svgContainer;
          const wrapper = this.toptext?.get(0);

          if (svg && wrapper) {
            const bbox = svg.getBoundingClientRect();
            wrapper.style.width = `${bbox.width}px`;
          }
      }

      mouseEnteredClue(e) {
        var target = $(e.currentTarget);
        this.hilited_word = this.words[target.data('word')];
        this.renderCells();
      }

      mouseLeftClue() {
        this.hilited_word = null;
        this.renderCells();
      }

      // callback for clicking a clue in the sidebar
      clueClicked(e) {
        if (this.fakeclues) {
          return;
        }
        var target = $(e.currentTarget),
          word = this.words[target.data('word')],
          cell = word.getFirstEmptyCell() || word.getFirstCell();
        if (cell) {
          this.setActiveWord(word);
          if (this.active_clues.id !== target.data('clues')) {
            this.changeActiveClues();
          }
          this.setActiveCell(cell);
          this.renderCells();
        }
      }

      showInfo() {
        this.createModalBox(
          'Info',
          `
            <p><b>${escape(this.title)}</b></p>
            <p>${escape(this.author)}</p>
            <p><i>${escape(this.copyright)}</i></p>
          `
        );
      }

      showNotepad() {
        this.createModalBox('Notes', escape(this.notepad));
      }

      openSettings() {
        // Create a modal box
        var settingsHTML = `
        <div class="settings-wrapper">
          <!-- Skip filled letters -->
          <div class="settings-setting">
            <div class="settings-description">
              While filling a word
            </div>
            <div class="settings-option">
              <label class="settings-label">
                <input id="skip_filled_letters" checked="checked" type="checkbox" name="skip_filled_letters" class="settings-changer">
                  Skip over filled letters
                </input>
              </label>
            </div>
            <div class="settings-option">
              <label class="settings-label">
                <input id="gray_completed_clues" type="checkbox" name="gray_completed_clues" class="settings-changer">
                  Gray out clues for completed words
                </input>
              </label>
            </div>
          </div>

          <!-- When changing direction with arrow keys -->
          <div class="settings-setting">
            <div class="settings-description">
              When changing direction with arrow keys
            </div>
            <div class="settings-option">
              <label class="settings-label">
                <input id="arrow_stay" checked="" type="radio" name="arrow_direction" class="settings-changer">
                  Stay in the same square
                </input>
              </label class="settings-label">
              <label class="settings-label">
                <input id="arrow_move" checked="" type="radio" name="arrow_direction" class="settings-changer">
                  Move in the direction of the arrow
                </input>
              </label>
              <label class="settings-label">
                <input id="arrow_move_filled" checked="" type="radio" name="arrow_direction" class="settings-changer">
                  Move in the direction of the arrow if the square is filled
                </input>
              </label>
            </div>
          </div>

          <!-- Space bar -->
          <div class="settings-setting">
            <div class="settings-description">
              When pressing space bar
            </div>
            <div class="settings-option">
              <label class="settings-label">
                <input id="space_clear" checked="" type="radio" name="space_bar" class="settings-changer">
                  Clear the current square and move forward
                </input>
              </label class="settings-label">
              <label class="settings-label">
                <input id="space_switch" checked="" type="radio" name="space_bar" class="settings-changer">
                  Switch directions
                </input>
              </label>
            </div>
          </div>

          <!-- Tab key -->
          <div class="settings-setting">
            <div class="settings-description">
              When tabbing
            </div>
            <div class="settings-option">
              <label class="settings-label">
                <input id="tab_noskip" checked="" type="radio" name="tab_key" class="settings-changer">
                  Move to the next word
                </input>
              </label class="settings-label">
              <label class="settings-label">
                <input id="tab_skip" checked="" type="radio" name="tab_key" class="settings-changer">
                  Move to the next unfilled word
                </input>
              </label>
            </div>
          </div>

          <!-- Timer -->
          <div class="settings-setting">
            <div class="settings-description">
              Timer
            </div>
            <div class="settings-option">
              <label class="settings-label">
                <input id="timer_autostart" checked="" type="checkbox" name="timer_autostart" class="settings-changer">
                  Start timer on puzzle open
                </input>
              </label>
            </div>
          </div>
        `;

        this.createModalBox('Settings', settingsHTML);
        // Show the proper value for each of these fields
        var classChangers = document.getElementsByClassName('settings-changer');
        for (var cc of classChangers) {
          if (cc.type === 'radio') {
            document.getElementById(cc.id)['checked'] =
              this.config[cc.name] === cc.id;
          } else {
            // checkbox
            document.getElementById(cc.id)['checked'] = this.config[cc.name];
          }
        }
        // Add a listener for these events
        this.root
          .find('.settings-wrapper')
          .get(0)
          .addEventListener('click', (event) => {
            if (event.target.className === 'settings-changer') {
              if (event.target.type === 'checkbox') {
                this.config[event.target.name] = event.target.checked;
                // need to add a special bit for dark mode
                if (event.target.name == 'dark_mode_enabled' && DarkReader) {
                  if (event.target.checked) {
                    DarkReader.enable({
                      brightness: 100,
                      contrast: 90,
                      sepia: 55
                    });
                    this.config.color_none = '#F2F2F2';
                    //this.config.font_color_fill = '#ddd4c5';
                    this.config.color_selected = '#5C5C42';
                    this.config.color_word = '#9E9E77';
                    this.renderCells();
                  } else {
                    DarkReader.disable();
                    this.config.color_none = default_config.color_none;
                    this.config.color_selected = default_config.color_selected;
                    this.config.color_word = default_config.color_word;
                    //this.config.font_color_fill = default_config.font_color_fill;
                    this.renderCells();
                  }

                    // If the toggled setting is gray_completed_clues, re-render clues immediately
                    if(event.target.name === 'gray_completed_clues') {
                      for (const wordId in this.words) {
                        this.updateClueAppearance(this.words[wordId]);
                      }
                  }
                }

              } else if (event.target.type === 'radio') {
                this.config[event.target.name] = event.target.id;
              }
            }
            this.saveSettings();
          });
      }

      fillJsXw() {
        // update this.jsxw with the currently filled letters
        var cells = this.cells;
        this.jsxw.cells.forEach(function (c) {
          var x = c['x']; var y = c['y'];
          c['letter'] = cells[x + 1][y + 1]['letter'];
        });
      }

      saveSettings() {
        // we only save settings that are configurable
        var ss1 = { ...this.config };
        var savedSettings = {};
        CONFIGURABLE_SETTINGS.forEach(function (x) {
          savedSettings[x] = ss1[x];
        })
        //console.log(savedSettings);
        localStorage.setItem(
          SETTINGS_STORAGE_KEY,
          JSON.stringify(savedSettings)
        );
      }

      /* Save the game to local storage */
      saveGame() {
        // fill jsxw
        this.fillJsXw();
        // stringify
        const jsxw_str = JSON.stringify(this.jsxw.cells);
        localStorage.setItem(this.savegame_name, jsxw_str);
        localStorage.setItem(this.savegame_name + "_notes", JSON.stringify(Array.from(this.notes.entries()).map(n => { return { key: n[0], value: n[1] } })));
        //this.createModalBox('ðŸ’¾', 'Progress saved.');
      }

      /* Show "load game" menu" */
      loadGameMenu() {
        // Find all the savegames
        var innerHTML = '';
        for (var i = 0; i < localStorage.length; i++) {
          var thisKey = localStorage.key(i);
          if (thisKey.startsWith(STORAGE_KEY)) {
            var thisJsXw = JSON.parse(localStorage.getItem(localStorage.key(i)));
            var thisDisplay = thisKey.substr(STORAGE_KEY.length);
            innerHTML += `
            <label class="settings-label">
              <input id="${thisKey}" checked="" type="radio" class="loadgame-changer">
                ${thisDisplay}
              </input>
            </label>
            `;
          }
        }
        if (!innerHTML) {
          innerHTML = 'No save games found.';
        }

        // Create a modal box
        var loadgameHTML = `
        <div class="loadgame-wrapper">
          ${innerHTML}
        </div>
        `;
        this.createModalBox('Load Game', loadgameHTML);
      }

      /* Load a game from local storage */
      loadGame() {
        var jsxw_cells = JSON.parse(localStorage.getItem(this.savegame_name));
        // don't actually *load* it, just return the jsxw
        return jsxw_cells;
        //if (jsxw) {
        //  this.removeListeners();
        //  this.parsePuzzle(jsxw);
        //}
      }

      /* Export a JPZ */
      exportJPZ() {
        // fill jsxw
        this.fillJsXw();
        const jpz_str = this.jsxw.toJPZString();
        // set filename
        var filename = this.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.jpz';
        // Initiate download
        var element = document.createElement('a');
        element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(jpz_str));
        element.setAttribute('download', filename);

        element.style.display = 'none';
        document.body.appendChild(element);

        element.click();
        document.body.removeChild(element);
      }

      set_theme(newThemeClass) {
        // EDIT HERE TO ADD THEME
        // this is where to set the theme class of the root to make it use diffrent variables'
        const page = document.querySelector(".crossword")
        page.classList.remove("dark-theme");
        page.classList.remove("earth-tones-theme");
        page.classList.remove("pumpkin-spice-theme");
        page.classList.remove("light-green-theme");
        page.classList.remove("light-blue-theme");
        page.classList.remove("barbie-theme");
        page.classList.remove("taco-bell-theme");
        page.classList.remove("grape-soda-theme");
        page.classList.remove("cherry-blossom-theme")
        page.classList.remove("momos-nail-corner-theme")
        page.classList.remove("frost-theme")
        page.classList.remove("cryptic-crossweird-theme")
        page.classList.remove("spring-pastels-theme")
        page.classList.add(newThemeClass);
        console.log("new theme class " + newThemeClass);

        switch (newThemeClass) {
          case 'dark-theme':
            console.log('setConfig');
            gCrossword.setConfig('color_selected', '#322533');
            gCrossword.setConfig('color_word', '#534A54');
            gCrossword.setConfig('color_block', '#212121');
            gCrossword.setConfig('color_none', '#3F4D59');
            gCrossword.setConfig('color_hilite', '#322533');
            gCrossword.setConfig('font_color_fill', '#FFFFFF');
            gCrossword.setConfig('font_color_clue', '#FFFFFF');
            break;
          case 'pumpkin-spice-theme':
            console.log('setConfig');
            gCrossword.setConfig('color_selected', '#9e2a2b');
            gCrossword.setConfig('color_word', '#E3AF7B');
            gCrossword.setConfig('color_block', '#212121');
            gCrossword.setConfig('color_none', '#FFFFFF');
            gCrossword.setConfig('color_hilite', '#E3AF7B');
            gCrossword.setConfig('font_color_fill', '#000000');
            gCrossword.setConfig('font_color_clue', '#000000');
            break;
          case 'earth-tones-theme':
            console.log('setConfig');
            gCrossword.setConfig('color_selected', '#754E42');
            gCrossword.setConfig('color_word', '#F7DFD0');
            gCrossword.setConfig('color_block', '#212121');
            gCrossword.setConfig('color_none', '#FFFFFF');
            gCrossword.setConfig('color_hilite', '#F7DFD0');
            gCrossword.setConfig('font_color_fill', '#000000');
            gCrossword.setConfig('font_color_clue', '#000000');
            break;
          case 'light-green-theme':
            gCrossword.setConfig('color_selected', '#9DB08F');
            gCrossword.setConfig('color_word', '#EFF5E9');
            gCrossword.setConfig('color_block', '#212121');
            gCrossword.setConfig('color_none', '#FFFFFF');
            gCrossword.setConfig('color_hilite', '#9DB08F');
            gCrossword.setConfig('font_color_fill', '#000000');
            gCrossword.setConfig('font_color_clue', '#000000');
            break;
          case 'light-blue-theme':
            gCrossword.setConfig('color_selected', '#506E85');
            gCrossword.setConfig('color_word', '#D7E9F5');
            gCrossword.setConfig('color_block', '#212121');
            gCrossword.setConfig('color_none', '#FFFFFF');
            gCrossword.setConfig('color_hilite', '#506E85')
            gCrossword.setConfig('font_color_fill', '#000000');
            gCrossword.setConfig('font_color_clue', '#000000');
            break;
          case 'barbie-theme':
            gCrossword.setConfig('color_selected', '#56D6FC');
            gCrossword.setConfig('color_word', '#FFCFE4');
            gCrossword.setConfig('color_block', '#212121');
            gCrossword.setConfig('color_none', '#FFE8F2');
            gCrossword.setConfig('color_hilite', '#56D6FC');
            gCrossword.setConfig('font_color_fill', '#000000');
            gCrossword.setConfig('font_color_clue', '#000000');
            break;
          case 'taco-bell-theme':
            gCrossword.setConfig('color_selected', '#289E94');
            gCrossword.setConfig('color_word', '#3DF2E3');
            gCrossword.setConfig('color_block', '#502859');
            gCrossword.setConfig('color_none', '#FFD4E6');
            gCrossword.setConfig('color_hilite', '#289E94');
            gCrossword.setConfig('font_color_fill', '#000000');
            gCrossword.setConfig('font_color_clue', '#000000');
            break;
          case 'grape-soda-theme':
            gCrossword.setConfig('color_selected', '#7976a4');
            gCrossword.setConfig('color_word', '#dfdfea');
            gCrossword.setConfig('color_block', '#2b256f');
            gCrossword.setConfig('color_none', '#FFFFFF');
            gCrossword.setConfig('color_hilite', '#289E94');
            gCrossword.setConfig('font_color_fill', '#000000');
            gCrossword.setConfig('font_color_clue', '#000000');
            break;
          case 'cherry-blossom-theme':
            gCrossword.setConfig('color_selected', '#F25477');
            gCrossword.setConfig('color_word', '#FFDCDC');
            gCrossword.setConfig('color_block', '#212121');
            gCrossword.setConfig('color_none', '#FFFFFF');
            gCrossword.setConfig('color_hilite', '#506E85');
            gCrossword.setConfig('font_color_fill', '#000000');
            gCrossword.setConfig('font_color_clue', '#000000');
            break;
          case 'momos-nail-corner-theme':
            gCrossword.setConfig('color_selected', '#98fdff');
            gCrossword.setConfig('color_word', '#d3feff');
            gCrossword.setConfig('color_block', '#abc837');
            gCrossword.setConfig('color_none', '#edf9c3');
            gCrossword.setConfig('color_hilite', '#289e94');
            gCrossword.setConfig('font_color_fill', '#000000');
            gCrossword.setConfig('font_color_clue', '#000000');
            break;
          case 'frost-theme':
            gCrossword.setConfig('color_selected', '#b0bef7');
            gCrossword.setConfig('color_word', '#e6eafc');
            gCrossword.setConfig('color_block', '#212121');
            gCrossword.setConfig('color_none', '#ffffff');
            gCrossword.setConfig('color_hilite', '#289e94');
            gCrossword.setConfig('font_color_fill', '#000000');
            gCrossword.setConfig('font_color_clue', '#000000');
            break;
          case 'cryptic-crossweird-theme':
            gCrossword.setConfig('color_selected', '#da854a');
            gCrossword.setConfig('color_word', '#eabc9b');
            gCrossword.setConfig('color_block', '#212121');
            gCrossword.setConfig('color_none', '#ffffff');
            gCrossword.setConfig('color_hilite', '#289e94');
            gCrossword.setConfig('font_color_fill', '#000000');
            gCrossword.setConfig('font_color_clue', '#000000');
            break;
          case 'spring-pastels-theme':
            gCrossword.setConfig('color_selected', '#e3addd');
            gCrossword.setConfig('color_word', '#f7e8f5');
            gCrossword.setConfig('color_block', '#212121');
            gCrossword.setConfig('color_none', '#ffffff');
            gCrossword.setConfig('color_hilite', '#289e94');
            gCrossword.setConfig('font_color_fill', '#000000');
            gCrossword.setConfig('font_color_clue', '#000000');
            break;
        }
        gCrossword.renderCells();
        /*if (gCrossword.clues_top) {
          gCrossword.renderClues(gCrossword.clues_top, gCrossword.clues_top_container);
        }
        if (gCrossword.clues_bottom) {
          gCrossword.renderClues(gCrossword.clues_bottom, gCrossword.clues_bottom_container);
        }*/
        var first_word = gCrossword.active_clues.getFirstWord()
        gCrossword.setActiveWord(first_word);
        gCrossword.setActiveCell(first_word.getFirstCell());

        this.renderCells();
        this.appliedThemeClass = newThemeClass; // <- track applied theme
        localStorage.setItem('selectedTheme', newThemeClass);
      }

      loadSavedTheme() {
        let savedTheme = localStorage.getItem('selectedTheme');
        if (!savedTheme) {
          savedTheme = 'cryptic-crossweird-theme';
          localStorage.setItem('selectedTheme', savedTheme);
        }
        this.set_theme(savedTheme);
        this.appliedThemeClass = savedTheme;
      }

      check_reveal(to_solve, reveal_or_check, e) {
        var my_cells = [],
          cell;
        switch (to_solve) {
          case 'letter':
            if (this.selected_cell) {
              my_cells = [this.selected_cell];
            }
            break;
          case 'word':
            if (this.selected_word) {
              var i, coordinates, cell;
              for (i = 0; (coordinates = this.selected_word.cells[i]); i++) {
                cell = this.selected_word.getCellByCoordinates(coordinates);
                if (cell) {
                  my_cells.push(cell);
                }
              }
            }
            break;
          case 'puzzle':
            var i, j, cell;
            for (i in this.cells) {
              for (j in this.cells[i]) {
                cell = this.cells[i][j];
                my_cells.push(cell);
              }
            }
            break;
        }

        // check and reveal also other numbers if autofill is on
        if (this.is_autofill) {
          var my_cells_length = my_cells.length;
          for (var i = 0; i < my_cells_length; i++) {
            var my_number = my_cells[i].number;
            if (my_number === null) {
              continue;
            }
            var other_cells = this.number_to_cells[my_number] || [];
            for (var other_cell of other_cells) {
              my_cells.push(this.cells[other_cell.x][other_cell.y]);
            }
          }
        }

        for (var i = 0; i < my_cells.length; i++) {
          if (!my_cells[i].solution || my_cells[i].type === 'block') {
            continue;
          }
          if (reveal_or_check == 'clear' && !my_cells[i].type) {
            my_cells[i].letter = '';
          }
          if (
            !isCorrect(my_cells[i].letter, my_cells[i].solution)
          ) {
            if (reveal_or_check == 'reveal') {
              my_cells[i].letter = my_cells[i].solution;
              my_cells[i].revealed = true;
              my_cells[i].checked = false;
            } else if (reveal_or_check == 'check') {
              my_cells[i].checked = true;
            }
          } else if (reveal_or_check == 'reveal' && isCorrect(my_cells[i].letter, my_cells[i].solution) && my_cells[i].letter !== my_cells[i].solution) {
            // i.e. the solution is "correct" but the letter doesn't match up
            my_cells[i].letter = my_cells[i].solution;
          }
        }
        this.renderCells();

        if (reveal_or_check == 'reveal') {
          this.checkIfSolved(false);
        }
        if (!isMobile) {
          this.hidden_input.focus();
        }
      }

      printPuzzle(e) {
        // fill JSXW
        this.fillJsXw();
        jscrossword_to_pdf(this.jsxw);
      }

      toggleTimer() {
        var display_seconds, display_minutes;
        var timer_btn = this.timer_button;

        function add() {
          xw_timer_seconds = xw_timer_seconds + 1;
          display_seconds = xw_timer_seconds % 60;
          display_minutes = (xw_timer_seconds - display_seconds) / 60;

          var display =
            (display_minutes
              ? display_minutes > 9
                ? display_minutes
                : '0' + display_minutes
              : '00') +
            ':' +
            (display_seconds > 9 ? display_seconds : '0' + display_seconds);

          timer_btn.html(display);
          timer();
        }

        function timer() {
          xw_timer = setTimeout(add, 1000);
        }

        if (this.timer_running) {
          // Stop the timer
          clearTimeout(xw_timer);
          timer_btn.removeClass('running');
          timer_btn.addClass('blink'); // Add blinking effect
          this.timer_running = false;
          if (!isMobile) {
            this.hidden_input.focus();
          }
        } else {
          // Start the timer
          timer_btn.removeClass('blink'); // Remove blinking effect
          this.timer_running = true;
          timer_btn.addClass('running');
          if (!isMobile) {
            this.hidden_input.focus();
          }
          timer();
        }
      }

      updateClueAppearance(word) {
        const clueEl = this.clues_holder.find(`.cw-clue.word-${word.id} .cw-clue-text`);

        if (!this.config.gray_completed_clues) {
          // Reset clue styling if the setting is turned off
          clueEl.css({
            "text-decoration": "",
            "color": ""
          });
          return;
        }

        if (word.isFilled()) {
          clueEl.css({
            "text-decoration": "",
            "color": "#aaa"
          });
        } else {
          clueEl.css({
            "text-decoration": "",
            "color": ""
          });
        }
      }
    }

    // CluesGroup stores clues and map of words
    class CluesGroup {
      constructor(crossword, data) {
        this.id = '';
        this.title = '';
        this.clues = [];
        this.clues_container = null;
        this.words_ids = [];
        this.crossword = crossword;
        if (data) {
          if (
            data.hasOwnProperty('id') &&
            data.hasOwnProperty('title') &&
            data.hasOwnProperty('clues') &&
            data.hasOwnProperty('words_ids')
          ) {
            this.id = data.id;
            this.title = data.title;
            this.clues = data.clues;
            this.words_ids = data.words_ids;
          } else {
            load_error = true;
          }
        }
      }

      getFirstWord() {
        if (this.words_ids.length) {
          return this.crossword.words[this.words_ids[0]];
        }
        return null;
      }

      getLastWord() {
        if (this.words_ids.length) {
          return this.crossword.words[
            this.words_ids[this.words_ids.length - 1]
          ];
        }
        return null;
      }

      // gets word which has cell with specified coordinates
      getMatchingWord(x, y, change_word = false) {
        var i,
          word_id,
          word,
          words = [];
        for (i = 0; (word_id = this.words_ids[i]); i++) {
          word = this.crossword.words.hasOwnProperty(word_id)
            ? this.crossword.words[word_id]
            : null;
          if (word && word.cells.indexOf(`${x}-${y}`) >= 0) {
            words.push(word);
          }
        }
        if (words.length == 1) {
          return words[0];
        } else if (words.length == 0) {
          return null;
        } else {
          // with more than one word we look for one
          // that's either current or not
          var finding_word = false;
          for (i = 0; i < words.length; i++) {
            word = words[i];
            if (change_word) {
              if (word.id == this.crossword.selected_word.id) {
                finding_word = true;
              } else if (finding_word) {
                return word;
              }
            } else {
              if (word.id == this.crossword.selected_word.id) {
                return word;
              }
            }
          }
          // if we didn't match a word in the above
          // just return the first one
          return words[0];
        }
        return null;
      }

      // in clues list, marks clue for word that has cell with given coordinates
      markActive(x, y, is_passive, fakeclues = false) {
        // don't mark anything as active if fake clues
        if (fakeclues) {
          return;
        }
        var classname = is_passive ? 'passive' : 'active',
          word = this.getMatchingWord(x, y),
          clue_el,
          clue_position,
          clue_height;
        this.clues_container.find('div.cw-clue.active').removeClass('active');
        this.clues_container.find('div.cw-clue.passive').removeClass('passive');
        if (word) {
          const clue_el = this.clues_container.find(
            'div.cw-clue.word-' + word.id
          );
          clue_el.addClass(classname);
          const clueRect = clue_el.get(0).getBoundingClientRect();

          const scrollContainer = clue_el.closest('.cw-clues-items');
          const scrollRect = scrollContainer.get(0).getBoundingClientRect();

          if (clueRect.top < scrollRect.top) {
            scrollContainer.stop().animate(
              {
                scrollTop:
                  scrollContainer.scrollTop() - (scrollRect.top - clueRect.top),
              },
              150
            );
          } else if (clueRect.bottom > scrollRect.bottom) {
            scrollContainer.stop().animate(
              {
                scrollTop:
                  scrollContainer.scrollTop() +
                  (clueRect.bottom - scrollRect.bottom),
              },
              150
            );
          }
        }
      }

      // returns word next to given
      getNextWord(word) {
        var next_word = null,
          index = this.words_ids.indexOf(word.id);
        if (index < this.words_ids.length - 1) {
          next_word = this.crossword.words[this.words_ids[index + 1]];
        }
        return next_word;
      }

      // returns word previous to given
      getPreviousWord(word) {
        var prev_word = null,
          index = this.words_ids.indexOf(word.id);
        if (index > 0) {
          prev_word = this.crossword.words[this.words_ids[index - 1]];
        }
        return prev_word;
      }
    }

    // Word constructor
    class Word {
      constructor(crossword, data) {
        this.id = '';
        this.dir = '';
        this.cell_ranges = [];
        this.cells = [];
        this.clue = {};
        this.refs_raw = [];
        this.crossword = crossword;
        if (data) {
          if (
            data.hasOwnProperty('id') &&
            data.hasOwnProperty('dir') &&
            data.hasOwnProperty('cell_ranges') &&
            data.hasOwnProperty('clue') &&
            data.hasOwnProperty('refs_raw')
          ) {
            this.id = data.id;
            this.dir = data.dir;
            this.cell_ranges = data.cell_ranges;
            this.clue = data.clue;
            //this.refs_raw = data.clue.refs;
            this.parseRanges();
          } else {
            load_error = true;
          }
        }
      }

      // Parses cell ranges and stores cells coordinates as array ['x1-y1', 'x1-y2' ...]
      parseRanges() {
        var i, k, cell_range;
        this.cells = [];
        for (i = 0; (cell_range = this.cell_ranges[i]); i++) {
          var split_x = cell_range.x.split('-'),
            split_y = cell_range.y.split('-'),
            x,
            y,
            x_from,
            x_to,
            y_from,
            y_to;

          if (split_x.length > 1) {
            x_from = Number(split_x[0]);
            x_to = Number(split_x[1]);
            y = split_y[0];
            for (
              k = x_from;
              x_from < x_to ? k <= x_to : k >= x_to;
              x_from < x_to ? k++ : k--
            ) {
              this.cells.push(`${k}-${y}`);
            }
          } else if (split_y.length > 1) {
            x = split_x[0];
            y_from = Number(split_y[0]);
            y_to = Number(split_y[1]);
            for (
              k = y_from;
              y_from < y_to ? k <= y_to : k >= y_to;
              y_from < y_to ? k++ : k--
            ) {
              this.cells.push(`${x}-${k}`);
            }
          } else {
            x = split_x[0];
            y = split_y[0];
            this.cells.push(`${x}-${y}`);
          }
        }
      }

      hasCell(x, y) {
        return this.cells.indexOf(`${x}-${y}`) >= 0;
      }

      // get first empty cell in word
      // if x and y given - get first empty cell after cell with coordinates x,y
      // if there's no empty cell after those coordinates - search from begin
      getFirstEmptyCell(x, y) {
        var i,
          cell,
          coordinates,
          start = 0;
        if (x && y) {
          start = Math.max(0, this.cells.indexOf(`${x}-${y}`));
          // if currently last cell - search from beginning
          if (start == this.cells.length - 1) {
            start = 0;
          }
        }
        for (i = start; (coordinates = this.cells[i]); i++) {
          cell = this.getCellByCoordinates(coordinates);
          if (cell && !cell.letter) {
            return cell;
          }
        }

        // if coordinates given and no cell found - search from beginning
        if (start > 0) {
          for (i = 0; i < start; i++) {
            cell = this.getCellByCoordinates(this.cells[i]);

            if (cell && !cell.letter) {
              return cell;
            }
          }
        }

        return null;
      }

      // Determine if the word is filled
      isFilled() {
        return this.getFirstEmptyCell() === null;
      }

      getFirstCell() {
        var cell = null;
        if (this.cells.length) {
          cell = this.getCellByCoordinates(this.cells[0]);
        }
        return cell;
      }

      getLastCell() {
        var cell = null;
        if (this.cells.length) {
          cell = this.getCellByCoordinates(this.cells[this.cells.length - 1]);
        }
        return cell;
      }

      getNextCell(x, y) {
        var index = this.cells.indexOf(`${x}-${y}`),
          cell = null;
        if (index < this.cells.length - 1) {
          cell = this.getCellByCoordinates(this.cells[index + 1]);
        }
        return cell;
      }

      getPreviousCell(x, y) {
        var index = this.cells.indexOf(`${x}-${y}`),
          cell = null;
        if (index > 0) {
          cell = this.getCellByCoordinates(this.cells[index - 1]);
        }

        return cell;
      }

      getCellByCoordinates(txt_coordinates) {
        var split, x, y, cell;
        split = txt_coordinates.split('-');
        if (split.length === 2) {
          x = split[0];
          y = split[1];
          cell = this.crossword.getCell(x, y);
          if (cell) {
            return cell;
          }
        }
        return null;
      }

      solve() {
        var i, coordinates, cell;
        for (i = 0; (coordinates = this.cells[i]); i++) {
          cell = this.getCellByCoordinates(coordinates);
          if (cell) {
            cell.letter = cell.solution;
          }
        }
      }
    }

    if (typeof define === 'function' && define.amd) {
      define('CrosswordNexus', [], function () {
        return CrosswordNexus;
      });
    }

    if (registerGlobal) {
      window.CrosswordNexus = CrosswordNexus;
    }

    return CrosswordNexus;
  }
);
