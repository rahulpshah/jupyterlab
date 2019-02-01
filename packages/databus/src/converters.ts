/*-----------------------------------------------------------------------------
| Copyright (c) Jupyter Development Team.
| Distributed under the terms of the Modified BSD License.
|----------------------------------------------------------------------------*/

import { Token } from '@phosphor/coreutils';
import { DisposableDelegate, IDisposable } from '@phosphor/disposable';
import { ISignal, Signal } from '@phosphor/signaling';
import { Dataset } from './dataregistry';
import { reachable, expandPath } from './graph';

/**
 * Function that can possibly convert between data type T to
 * data type V.
 *
 * It determines if it is able to convert T, based on it's mimetype
 * and returns a mapping of possible resulting mimetypes and
 * a function to compute their data.
 */
export type Converter<T, V> = (
  mimeType: string
) => Map<string, (data: T) => Promise<V>>;

function composeConverters<T, V>(
  a: Converter<T, V>,
  b: Converter<T, V>
): Converter<T, V> {
  return (mimeType: string) => {
    return new Map([...a(mimeType), ...b(mimeType)]);
  };
}

function emptyConverter(mimeType: string): Map<string, (data: never) => never> {
  return new Map();
}

function composeManyConverters<T, V>(
  converters: Iterable<Converter<T, V>>
): Converter<T, V> {
  return [...converters].reduce(composeConverters, emptyConverter);
}

export function singleConverter<T, V>(
  fn: (mimeType: string) => null | [string, (data: T) => Promise<V>]
): Converter<T, V> {
  return (mimeType: string) => {
    const possibleResult = fn(mimeType);
    if (possibleResult === null) {
      return new Map();
    }
    return new Map([possibleResult]);
  };
}

export interface ISeperateConverterOptions<T, V> {
  /**
   * Computes the target mime type, given some source mimetype. If the convert is unable to
   * convert this mimetype, it should return `null`.
   */
  computeMimeType: (mimeType: string) => string | null;

  /**
   * The conversion function.
   */
  convert: (data: T) => Promise<V>;
}

/**
 * Create a convert by specifying seperate functions to compute the mimetype
 * and convert the data.
 */
export function seperateConverter<T, V>({
  computeMimeType,
  convert
}: ISeperateConverterOptions<T, V>): Converter<T, V> {
  return singleConverter((mimeType: string) => {
    const targetMimeType = computeMimeType(mimeType);
    if (targetMimeType == null) {
      return null;
    }
    return [targetMimeType, convert];
  });
}

export interface IStaticConverterOptions<T, V> {
  /**
   * The input mime type of the data of type `A` to be converted.
   */
  sourceMimeType: string;

  /**
   * The output mime type of the converted data of type `B`.
   */
  targetMimeType: string;
  /**
   * The conversion function.
   */
  convert: (data: T) => Promise<V>;
}

export function staticConverter<T, V>({
  sourceMimeType,
  targetMimeType,
  convert
}: IStaticConverterOptions<T, V>): Converter<T, V> {
  return seperateConverter({
    computeMimeType: (mimeType: string) => {
      if (mimeType === sourceMimeType) {
        return targetMimeType;
      }
      return null;
    },
    convert
  });
}

/**
 * A registry for data converters.
 *
 * Questions:
 *
 * - Should we allow multiple converters between two mime types? If so, how do
 *   we decide which to use?
 * - Do we walk to graph to find chains of converters betweeen the source and target?
 */
export class ConverterRegistry {
  /**
   * Register a dataset converter
   *
   * @param converter - the `IConverter` to register.
   *
   * @returns A disposable which will remove the converter from the registry.
   *
   * @throws An error if the converter is already registered.
   */
  register(converter: Converter<any, any>): IDisposable {
    this._converters.add(converter);

    this._convertersChanged.emit({ converter, type: 'added' });

    return new DisposableDelegate(() => {
      this._converters.delete(converter);
      this._convertersChanged.emit({ converter, type: 'removed' });
    });
  }

  /**
   * A signal that will fire when converters are registered or removed.
   */
  get convertersChanged(): ISignal<
    this,
    ConverterRegistry.IConvertersChangedArgs
  > {
    return this._convertersChanged;
  }

  /**
   * Converts a dataset to a new mimetype.
   *
   * Takes in a set of datasets that
   * Returns a an asyncronous iterator of the dataset(s) to get from the initial
   * dataset to the target.
   */
  async *convert(
    sourceDatasets: Iterable<Dataset<any>>,
    targetMimeType: string
  ): AsyncIterableIterator<Dataset<any>> {
    const urls: Set<URL> = new Set();
    const datas: Map<string, any> = new Map();
    for (const { url, mimeType, data } of sourceDatasets) {
      urls.add(url);
      datas.set(mimeType, data);
    }
    if (urls.size !== 1) {
      throw new Error(
        `Datasets with different URLs were passed into convert: ${urls}`
      );
    }
    const [url] = urls;

    for (const [initialMimeType, convert, resultMimeType] of expandPath(
      targetMimeType,
      this._reachable(datas.keys()).get(targetMimeType)
    )) {
      // First part of path only has result
      if (!initialMimeType) {
        yield [...sourceDatasets].find(
          dataset => dataset.mimeType === resultMimeType
        );
        continue;
      }
      const data = await convert(datas.get(initialMimeType));
      datas.set(resultMimeType, data);
      yield new Dataset(resultMimeType, url, data);
    }
  }

  /**
   * List the available target mime types for input mime types.
   *
   * @param sourceMimeType - the input mime types.
   *
   * @returns An `Set<string>` of the available target mime types.
   */
  listTargetMimeTypes(sourceMimeTypes: Iterable<string>): Set<string> {
    return new Set(this._reachable(sourceMimeTypes).keys());
  }

  /**
   * Returns a mapping of mimetypes to the path to get to them,
   * of the new mimetype and the function converting the data.
   * @param mimeType Mimetype to start at.
   */
  private _reachable(
    mimeTypes: Iterable<string>
  ): Map<string, Iterable<[string, (data: any) => any]>> {
    const converter = composeManyConverters(this._converters);
    return reachable(converter, new Set(mimeTypes));
  }

  private _converters: Set<Converter<any, any>> = new Set();
  private _convertersChanged = new Signal<
    this,
    ConverterRegistry.IConvertersChangedArgs
  >(this);
}

/**
 * A public namespace for the converter registry.
 */
export namespace ConverterRegistry {
  /**
   * An interface for the changed args of the converters changed signal.
   */
  export interface IConvertersChangedArgs {
    /**
     * The converter begin added or removed.
     */
    readonly converter: Converter<any, any>;

    /**
     * The type of change.
     */
    readonly type: 'added' | 'removed';
  }
}

/* tslint:disable */
export const IConverterRegistry = new Token<IConverterRegistry>(
  '@jupyterlab/databus:IConverterRegistry'
);

export interface IConverterRegistry extends ConverterRegistry {}
