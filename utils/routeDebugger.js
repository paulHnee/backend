function printRoutes(app) {
  console.log('\nRegistered Routes:');
  console.log('----------------');
  
  function print(path, layer) {
    if (layer.route) {
      layer.route.stack.forEach(r => {
        const method = Object.keys(r.route.methods)[0].toUpperCase();
        console.log(`${method}\t${path}${r.route.path}`);
      });
    } else if (layer.name === 'router' && layer.handle.stack) {
      layer.handle.stack.forEach(stackItem => {
        print(path + (layer.regexp.source === "^\\/?(?=\\/|$)" ? '' : layer.regexp.source.replace(/\\\//g, '/').replace(/\^|\$/g, '').replace(/\?/g, '')), stackItem);
      });
    }
  }

  app._router.stack.forEach(layer => {
    print('', layer);
  });
  
  console.log('----------------\n');
}

module.exports = printRoutes;