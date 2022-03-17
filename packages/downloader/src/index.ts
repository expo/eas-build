import stream from 'stream';
import { promisify } from 'util';

import fs from 'fs-extra';
import got from 'got';

const pipeline = promisify(stream.pipeline);

async function downloadFile(srcUrl: string, outputPath: string, timeout?: number): Promise<void> {
  try {
    await pipeline(got.stream(srcUrl, { timeout }), fs.createWriteStream(outputPath));
  } catch (err: any) {
    await fs.remove(outputPath);
    throw new Error(`Failed to download the file: ${err?.message}\n${err?.stack}`);
  }
}

export default downloadFile;
