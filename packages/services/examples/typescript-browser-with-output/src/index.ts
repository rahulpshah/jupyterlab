/*-----------------------------------------------------------------------------
| Copyright (c) 2014-2017, Jupyter Development Team.
|
| Distributed under the terms of the Modified BSD License.
|----------------------------------------------------------------------------*/

import { PageConfig, URLExt } from '@jupyterlab/coreutils';
// @ts-ignore
__webpack_public_path__ = URLExt.join(PageConfig.getBaseUrl(), 'example/');

import { OutputArea, OutputAreaModel } from '@jupyterlab/outputarea';

import {
  RenderMimeRegistry,
  standardRendererFactories as initialFactories
} from '@jupyterlab/rendermime';

import { Kernel } from '@jupyterlab/services';

async function main() {
  const code = [
    'from IPython.display import HTML',
    'HTML("<h1>Hello, world!</h1>")'
  ].join('\n');
  const model = new OutputAreaModel();
  const rendermime = new RenderMimeRegistry({ initialFactories });
  const outputArea = new OutputArea({ model, rendermime });

  const kernel = await Kernel.startNew();
  outputArea.future = kernel.requestExecute({ code });
  document.getElementById('outputarea').appendChild(outputArea.node);
  await outputArea.future.done;
  console.log('Test complete!');
}

window.onload = main;
