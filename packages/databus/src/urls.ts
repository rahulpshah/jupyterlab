import { Converter, seperateConverter, singleConverter } from './converters';
import { extractResolveMimeType } from '.';

const baseMimeType = 'application/x.jupyter.url; mimeType=';

export function URLMimeType(mimeType: string) {
  return `${baseMimeType}${mimeType}`;
}

export function extractURLMimeType(mimeType: string): string | null {
  if (!mimeType.startsWith(baseMimeType)) {
    return null;
  }
  return mimeType.slice(baseMimeType.length);
}

export const resolverURLConverter: Converter<string, URL> = singleConverter(
  (mimeType: string, url: URL) => {
    const resMimeType = extractResolveMimeType(mimeType);
    if (resMimeType === null) {
      return null;
    }
    const isHTTP = url.protocol === 'http:';
    const isHTTPS = url.protocol === 'https:';
    // TODO: What if URL is differnt from this URL? How to support mimetypes then
    if (isHTTP || isHTTPS) {
      return [URLMimeType(resMimeType), async () => url];
    }
    return null;
  }
);

export const URLStringConverter: Converter<
  URL | string,
  string
> = seperateConverter({
  computeMimeType: extractURLMimeType,
  convert: async (url: URL | string) => {
    const response = await fetch(url.toString());
    return await response.text();
  }
});
