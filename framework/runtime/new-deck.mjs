import { createPresentationScaffold, parseNewDeckCliArgs } from './services/scaffold-service.mjs';

let parsed;
try {
  parsed = parseNewDeckCliArgs(process.argv.slice(2));
} catch (err) {
  console.error(`Usage: npm run new -- --project /abs/path [--slides <count>] [--copy-framework]\n\n${err.message}`);
  process.exit(1);
}

try {
  console.log(JSON.stringify(createPresentationScaffold(parsed.target, {
    slideCount: parsed.slideCount,
    copyFramework: parsed.copyFramework,
  }), null, 2));
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
