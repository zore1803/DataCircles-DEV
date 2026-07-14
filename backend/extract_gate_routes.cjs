const fs = require('fs');
const path = require('path');

const routesDir = 'c:\\Users\\cdosh\\Downloads\\DataCirclesCRM-DEV-main\\DataCirclesCRM-DEV-main\\backend\\routes';

const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));

const resultsByFile = {};

files.forEach(file => {
  const filePath = path.join(routesDir, file);
  const content = fs.readFileSync(filePath, 'utf8');
  
  if (!content.includes('subscriptionGate')) return;
  
  const lines = content.split('\n');
  const fileRoutes = [];
  
  // A regex pattern to match: router.<method>(path, ...middlewares)
  // Let's parse router calls.
  // We can look for lines that contain router.get, router.post, router.put, router.delete, router.patch, router.options, router.head
  // and trace if they contain subscriptionGate.
  // Many router patterns span multiple lines, e.g.:
  // router.post(
  //   "/",
  //   requireAuth,
  //   subscriptionGate,
  //   ...
  // )
  
  // Let's match router methods using a parser or multiline regex.
  const regex = /router\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]\s*,([\s\S]*?)\)/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const method = match[1].toUpperCase();
    const routePath = match[2];
    const middlewareChain = match[3];
    
    if (middlewareChain.includes('subscriptionGate')) {
      // Extract handler (last item in the chain before closing parenthesis, stripped of whitespace/commas)
      const parts = middlewareChain.split(',').map(s => s.trim()).filter(Boolean);
      const handler = parts[parts.length - 1] || 'unknown';
      
      fileRoutes.push({
        method,
        path: routePath,
        handler
      });
    }
  }
  
  if (fileRoutes.length > 0) {
    resultsByFile[file] = fileRoutes;
  }
});

console.log(JSON.stringify(resultsByFile, null, 2));
