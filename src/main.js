var gui = require('nw.gui'),
    config = require('rc')('wed'),
    mix = require('u.mix'),
    Lib = require('./lib/lib'),
    fs = require('fs');

var lib = Lib({
  document: document,
  _: _
});

var dom = lib.dom,
    fsPathHandler = lib.fs.pathHandler,
    fsMode = lib.fs.mode;

// # init josh

var history = new Josh.History({ key: 'wed.history'}),
    shell = Josh.Shell({ history: history }),
    panel = dom('shell-panel');
    
panel.style.display = 'none';
config.keymap.shell.nofallthrough = true;

// ## init path handler

/**
 * An initial node resolves lots of problems and checks in path handling
 * functions getNode() and getChildNodes() as in the prompt handler
 * defined below
 */
var root = {
  path: '/',
  name: ''
};

var pathHandler = mix(fsPathHandler, { current: root })
		.in(new Josh.PathHandler(shell));

// ## init prompt

shell.onNewPrompt(function (callback) {
  var path = '/' + pathHandler.current.path
          .split('/').filter(Boolean).join('/');

  callback(path + '>');
});

// # init codemirror

var editor = dom.div();
editor.className = 'editor';

var cm = CodeMirror(editor, config.editor);
cm.focus();
cm.addKeyMap(config.keymap.editor);

// ## open file from command line

var args = gui.App.argv,
    current = {};

if (args.length) {
  var arg = args[0],
      start = arg[0] === '/' ? '' : process.env.PWD,
      path = start + '/' + arg,
      mode = fsMode(path) || {};

  fs.readFile(path, { encoding: 'utf-8' }, function (err, data) {
    if (err) {
      current.isNew = true;
      return;
    }
      
    cm.replaceRange(data, CodeMirror.Pos(cm.lastLine()));
  });

  cm.setOption('mode', mode.mode);
  current.path = path;
}

// # plugins

// ## plugin dependency injection

var wed = {
  gui: gui,
  codemirror: cm,
  josh: shell,
  pathHandler: pathHandler,
  lib: lib,
  config: config,
  current: current,
  root: (function () {
    var logicalRoot = process.env.PWD;

    return function (newRoot) {
      if (newRoot) {
        logicalRoot = newRoot;
      }

      return logicalRoot;
    };
  })(),
  cwd: function () {
    return pathHandler.current.path;
  }
};

// ## init task plugins

mix.apply(null, config.tasks.map(function (task) {
  return require('./plugins/tasks/' + task)(wed);
})).in(CodeMirror.commands);

// ## init command plugins

var commands = mix.apply(null, config.commands.map(function (command) {
  return require('./plugins/commands/' + command)(wed);
})).in();

Object.keys(commands).forEach(function (cmdName) {
  var command = commands[cmdName];

  // (#25) handle possible errors to prevent prompt crashes
  shell.setCommandHandler(cmdName, {
      exec: function (cmd, args, callback) {
        try {
          command.exec.apply(this, arguments);
        } catch (e) {
          callback(e);
        }
      },
      completion: command.completion
  });
});
