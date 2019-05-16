// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { Widget } from '@phosphor/widgets';

import { Token } from '@phosphor/coreutils';

import { IInstanceTracker, MainAreaWidget } from '@jupyterlab/apputils';

import { TerminalSession } from '@jupyterlab/services';

import '../style/index.css';

/**
 * A class that tracks editor widgets.
 */
export interface ITerminalTracker
  extends IInstanceTracker<MainAreaWidget<ITerminal.ITerminal>> {}

/* tslint:disable */
/**
 * The editor tracker token.
 */
export const ITerminalTracker = new Token<ITerminalTracker>(
  '@jupyterlab/terminal:ITerminalTracker'
);
/* tslint:enable */

/**
 * The namespace for terminals. Separated from the widget so it can be lazy
 * loaded.
 */
export namespace ITerminal {
  export interface ITerminal extends Widget {
    /**
     * The terminal session associated with the widget.
     */
    session: TerminalSession.ISession;

    /**
     * Get a config option for the terminal.
     */
    getOption<K extends keyof IOptions>(option: K): IOptions[K];

    /**
     * Set a config option for the terminal.
     */
    setOption<K extends keyof IOptions>(option: K, value: IOptions[K]): void;

    /**
     * Refresh the terminal session.
     */
    refresh(): Promise<void>;
  }
  /**
   * Options for the terminal widget.
   */
  export interface IOptions {
    /**
     * The font family used to render text.
     */
    fontFamily: string | null;

    /**
     * The font size of the terminal in pixels.
     */
    fontSize: number;

    /**
     * The line height used to render text.
     */
    lineHeight: number | null;

    /**
     * The theme of the terminal.
     */
    theme: Theme;

    /**
     * The amount of buffer scrollback to be used
     * with the terminal
     */
    scrollback: number | null;

    /**
     * Whether to shut down the session when closing a terminal or not.
     */
    shutdownOnClose: boolean;

    /**
     * Whether to blink the cursor.  Can only be set at startup.
     */
    cursorBlink: boolean;

    /**
     * An optional command to run when the session starts.
     */
    initialCommand: string;

    /**
     * Wether to enable screen reader support.
     *
     * Set to false if you run into performance problems from DOM overhead
     */
    screenReaderMode: boolean;
  }

  /**
   * The default options used for creating terminals.
   */
  export const defaultOptions: IOptions = {
    theme: 'inherit',
    fontFamily: 'Menlo, Consolas, "DejaVu Sans Mono", monospace',
    fontSize: 13,
    lineHeight: 1.0,
    scrollback: 1000,
    shutdownOnClose: false,
    cursorBlink: true,
    initialCommand: '',
    screenReaderMode: true
  };

  /**
   * A type for the terminal theme.
   */
  export type Theme = 'light' | 'dark' | 'inherit';

  /**
   * A type for the terminal theme.
   */
  export interface IThemeObject {
    foreground: string;
    background: string;
    cursor: string;
    cursorAccent: string;
    selection: string;
  }
}
