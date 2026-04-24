import fs from 'fs';
import path from 'path';
import { JSDOM, VirtualConsole } from 'jsdom';

const html = fs.readFileSync('dist/index.html', 'utf8');

const virtualConsole = new VirtualConsole();
virtualConsole.on("error", (...args) => { console.error("JSDOM ERROR:", ...args); });
virtualConsole.on("warn", (...args) => { console.warn("JSDOM WARN:", ...args); });
virtualConsole.on("info", (...args) => { console.info("JSDOM INFO:", ...args); });
virtualConsole.on("log", (...args) => { console.log("JSDOM LOG:", ...args); });

const dom = new JSDOM(html, {
  runScripts: "dangerously",
  resources: "usable",
  url: "http://localhost/",
  virtualConsole
});
