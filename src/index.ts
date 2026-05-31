import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { requestAPI } from './request';

/**
 * Initialization data for the jupyterlab_edit_markdown_at_content_extension extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlab_edit_markdown_at_content_extension:plugin',
  description: 'Jupyterlab extension to save you the scrolling time from when you are at markdown file location and open editor and need to scroll to the exact place in the file where the content is. This extension opens the editor at the place where the content is',
  autoStart: true,
  activate: (app: JupyterFrontEnd) => {
    console.log('JupyterLab extension jupyterlab_edit_markdown_at_content_extension is activated!');

    requestAPI<any>('hello', app.serviceManager.serverSettings)
      .then(data => {
        console.log(data);
      })
      .catch(reason => {
        console.error(
          `The jupyterlab_edit_markdown_at_content_extension server extension appears to be missing.\n${reason}`
        );
      });
  }
};

export default plugin;
