/**
 * How to run grunt tasks:
 *   - At project root, run 'npm install' - It will install nodedependencies declared in package,json in <root>/.node_modules
 *   - install grunt CLI tools globally, run 'npm install -g grunt-cli'
 *   - run a grunt target defined in Gruntfiles.js, ex: 'grunt lint'
 *
 * Note: The 'ghost' grunt task have special deps on CasperJS and phantomjs.
 *       For now, It's configured to run only on TravisCI where these deps are
 *       correctly defined.
 *       If you run this task locally, it may require some env set up first.
 */

var SOURCE_FOLDER = "src";

module.exports = function(grunt) {
  var dateFormat = require('dateformat');
  var now = new Date();
  var version = '-' + dateFormat(now, "yyyy-mm-dd-hh-MM");

  var mapToSrcFolder = function (path) {return [SOURCE_FOLDER, path].join('/');};

  var piskelScripts = require('./src/piskel-script-list.js').scripts.map(mapToSrcFolder);
  var piskelStyles = require('./src/piskel-style-list.js').styles.map(mapToSrcFolder);

  var getGhostConfig = function (delay) {
    return {
      filesSrc : ['test/integration/casperjs/*_test.js'],
      options : {
        args : {
          baseUrl : 'http://localhost:' + '<%= connect.test.options.port %>/src/',
          mode : '?debug',
          delay : delay
        },
        direct : false,
        logLevel : 'info',
        printCommand : false,
        printFilePaths : true
      }
    };
  };

  grunt.initConfig({
    clean: {
      before: ['dest'],
      after: ['build/closure/closure_compiled_binary.js']
    },
    jshint: {
      options: {
        indent:2,
        undef : true,
        latedef : true,
        browser : true,
        trailing : true,
        curly : true,
        es3 : true,
        globals : {'$':true, 'jQuery' : true, 'pskl':true, 'Events':true, 'Constants':true, 'console' : true, 'module':true, 'require':true}
      },
      files: [
        'Gruntfile.js',
        'package.json',
        'src/js/**/*.js',
        '!src/js/lib/**/*.js' // Exclude lib folder (note the leading !)
      ]
    },
    connect : {
      test : {
        options : {
          base : '.',
          port : 4321
        }
      }
    },
    express: {
      regular: {
        options: {
          port: 9001,
          hostname : 'localhost',
          bases: ['dest']
        }
      },
      debug: {
        options: {
          port: 9901,
          hostname : 'localhost',
          bases: ['src']
        }
      }
    },
    open : {
      regular : {
        path : 'http://localhost:9001/'
      },
      debug : {
        path : 'http://localhost:9901/?debug'
      }
    },

    watch: {
      scripts: {
        files: ['src/**/*.*'],
        tasks: ['merge'],
        options: {
          spawn: false
        }
      }
    },
    ghost : {
      'default' : getGhostConfig(5000),
      local : getGhostConfig(50)
    },
    concat : {
      js : {
        options : {
          separator : ';'
        },
        src : piskelScripts,
        dest : 'dest/js/piskel-packaged' + version + '.js'
      },
      css : {
        src : piskelStyles,
        dest : 'dest/css/piskel-style-packaged' + version + '.css'
      }
    },
    uglify : {
      options : {
        mangle : true
      },
      my_target : {
        files : {
          'dest/js/piskel-packaged-min.js' : ['dest/js/piskel-packaged' + version + '.js']
        }
      }
    },
    replace: {
      main: {
        options: {
          patterns: [
            {
              match: 'version',
              replacement: version
            }
          ]
        },
        files: [
          {expand: true, flatten: true, src: ['src/piskel-boot-0.1.0.js'], dest: 'dest/'}
        ]
      },
      editor: {
        options: {
          patterns: [
            {
              match: /templates\//g,
              replacement: "../templates"+version+"/"
            },{
              match: /^(.|[\r\n])*<!--body-main-start-->/,
              replacement: "",
              description : "Remove everything before body-main-start comment"
            },{
              match: /<!--body-main-end-->(.|[\r\n])*$/,
              replacement: "",
              description : "Remove everything after body-main-end comment"
            },{
              match: /([\r\n])  /g,
              replacement: "$1",
              description : "Decrease indentation by one"
            }
          ]
        },
        files: [
          {src: ['src/index.html'], dest: 'dest/piskelapp-partials/main-partial.html'}
        ]
      }
    },
    copy: {
      main: {
        files: [
          {src: ['dest/js/piskel-packaged-min.js'], dest: 'dest/js/piskel-packaged-min' + version + '.js'},
          {src: ['src/logo.png'], dest: 'dest/logo.png'},
          {src: ['src/js/lib/iframeLoader-0.1.0.js'], dest: 'dest/js/lib/iframeLoader-0.1.0.js'},
          {src: ['src/js/lib/gif/gif.ie.worker.js'], dest: 'dest/js/lib/gif/gif.ie.worker.js'},
          {expand: true, src: ['img/**'], cwd: 'src/', dest: 'dest/', filter: 'isFile'},
          {expand: true, src: ['css/fonts/**'], cwd: 'src/', dest: 'dest/', filter: 'isFile'},
          {expand: true, src: ['**/*.html'], cwd: 'src/', dest: 'dest/', filter: 'isFile'}
        ]
      }
    },
    closureCompiler:  {
      options: {
        // [REQUIRED] Path to closure compiler
        compilerFile: 'build/closure/closure_compiler_20130823.jar',

        // [OPTIONAL] set to true if you want to check if files were modified
        // before starting compilation (can save some time in large sourcebases)
        //checkModified: true,

        // [OPTIONAL] Set Closure Compiler Directives here
        compilerOpts: {
          /**
           * Keys will be used as directives for the compiler
           * values can be strings or arrays.
           * If no value is required use null
           */
          //compilation_level: 'ADVANCED_OPTIMIZATIONS',
          compilation_level: 'SIMPLE_OPTIMIZATIONS',
          externs: ['build/closure/piskel-closure-externs.js'],
          // Inject some constants in JS code, could we use that for appengine wiring ?
          //define: ["'goog.DEBUG=false'"],
          warning_level: 'verbose',
          jscomp_off: ['checkTypes', 'fileoverviewTags'],
          summary_detail_level: 1,
          language_in: 'ECMASCRIPT3'
          //output_wrapper: '"(function(){%output%}).call(this);"'
        },
        execOpts: { // [OPTIONAL] Set exec method options
          maxBuffer: 999999 * 1024
        }

      },
      compile: {

        /**
         *[OPTIONAL] Here you can add new or override previous option of the Closure Compiler Directives.
         * IMPORTANT! The feature is enabled as a temporary solution to [#738](https://github.com/gruntjs/grunt/issues/738).
         * As soon as issue will be fixed this feature will be removed.
         */
        TEMPcompilerOpts: {
        },
        src: [
          'src/js/**/*.js',
          'src/piskel-boot-0.1.0.js',
          'src/piskel-script-list.js',
          '!src/js/lib/**/*.js'
        ],

        // This generated JS binary is currently not used and even excluded from source control using .gitignore.
        dest: 'build/closure/closure_compiled_binary.js'
      }
    },
    nodewebkit: {
      options: {
        build_dir: './dest/desktop/', // destination folder of releases.
        mac: true,
        win: true,
        linux32: true,
        linux64: true
      },
      src: ['./dest/**/*', "./package.json", "!./dest/desktop/"]
    }
  });

  grunt.config.set('leadingIndent.indentation', 'spaces');
  grunt.config.set('leadingIndent.jsFiles', {
    src: [
      'src/js/**/*.js',
      '!src/js/lib/**/*.js'
    ]
  });
  grunt.config.set('leadingIndent.cssFiles', {
    src: ['src/css/**/*.css']
  });

  grunt.loadNpmTasks('grunt-closure-tools');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-connect');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-express');
  grunt.loadNpmTasks('grunt-replace');
  grunt.loadNpmTasks('grunt-ghost');
  grunt.loadNpmTasks('grunt-open');
  grunt.loadNpmTasks('grunt-leading-indent');
  grunt.loadNpmTasks('grunt-node-webkit-builder');
  grunt.loadNpmTasks('grunt-contrib-copy');

  // Validate
  grunt.registerTask('lint', ['leadingIndent:jsFiles', 'leadingIndent:cssFiles', 'jshint']);

  // Validate & Test
  grunt.registerTask('test', ['lint', 'compile', 'connect:test', 'ghost:default']);

  // Validate & Test (faster version) will NOT work on travis !!
  grunt.registerTask('precommit', ['lint', 'compile', 'connect:test', 'ghost:local']);

  // Compile JS code (eg verify JSDoc annotation and types, no actual minified code generated).
  grunt.registerTask('compile', ['closureCompiler:compile', 'clean:after']);

  grunt.registerTask('rep', ['replace:main', 'replace:editor']);

  grunt.registerTask('merge',  ['concat:js', 'concat:css', 'uglify', 'rep', 'copy']);

  // Validate & Build
  grunt.registerTask('default', ['clean:before', 'lint', 'compile', 'merge']);

  // Build stand alone app with nodewebkit
  grunt.registerTask('desktop', ['default', 'nodewebkit']);

  grunt.registerTask('server', ['merge', 'express:regular', 'open:regular', 'express-keepalive']);

  // Start webserver and watch for changes
  grunt.registerTask('server:watch', ['server', 'watch']);

  // Start webserver on src folder, in debug mode
  grunt.registerTask('server:debug', ['express:debug', 'open:debug', 'express-keepalive']);
};
