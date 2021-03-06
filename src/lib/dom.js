module.exports = function (deps) {
  var document = deps.document;

  var dom = document.getElementById.bind(document);

  dom.div = function () {
    var d = document.createElement('div');
    return dom('canvas').appendChild(d);
  };

  return dom;
};
