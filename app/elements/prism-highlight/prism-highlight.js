(function() {
'use strict';

class PrismHighlight {
  beforeRegister() {
    this.is = 'prism-highlight';
    this.properties = {
      /**
       * A data to be highlighted and dispayed.
       */
      code: String,
      /**
       * Prism supported language.
       */
      lang: String,
      /**
       * A list of tokenized code.
       * It's a result of calling `Prism.tokenize` function.
       */
      tokenized: {
        type: Array,
        readOnly: true
      },
      /**
       * True if not all data has been displayed in the display.
       */
      hasMore: {
        type: Boolean,
        readOnly: true,
        computed: '_computeHasMore(tokenized)'
      },
      /**
       * A number of lined to display at once.
       * After the limit is reached the display will show "load next [maxRead] items" and
       * "load all" buttons.
       */
      maxRead: {
        type: Number,
        value: 500
      },
      // True when parsing code or tokens to HTML code.
      working: {
        type: Boolean,
        value: false,
        readOnly: true
      },

      // An element which should be searched for text.
      _textSearch: {
        type: HTMLElement,
        value: function() {
          return this.$.output;
        }
      }
    };
  }

  get observers() {
    return [
      '_highlight(code, lang)'
    ];
  }

  get behaviors() {
    return [
      ArcBehaviors.TextSearchBehavior
    ];
  }

  detached() {
    if (this.worker) {
      this.worker.terminate();
      this.worker.onmessage = null;
      this.worker.onerror = null;
      this.worker = null;
    }
  }
  /**
   * Hightligt the code.
   * @param {String} data The code to be highlighted
   * @param {String} mime Mime type to be used to recognize the language.
   */
  _highlight(data, mime) {
    this._setTokenized(undefined);
    this.$.output.innerHTML = '';
    var message = {
      'language': mime,
      'code': data,
      'payload': 'tokenize'
    };
    this._runWorker(message);
  }
  /**
   * Sends message to the hightligt worker if its already created.
   * If not, this will create worker and then post message.
   * @param {Objects} message An object to pass to the worker.
   */
  _runWorker(message) {
    this._setWorking(true);
    if (this.worker) {
      this.worker.postMessage(message);
      return;
    }
    this.worker = new Worker('/scripts/workers/prism-worker.js');
    this.worker.onmessage = this._onWorkerData.bind(this);
    this.worker.onerror = this._onWorkerError.bind(this);
    this.worker.postMessage(message);
  }

  _onWorkerData(e) {
    this._setWorking(false);
    switch (e.data.payload) {
      case 'tokenize':
        this._onTokenized(e.data.tokens);
        break;
      case 'stringify':
        this._display(e.data.html);
        break;
    }
  }

  _onWorkerError(e) {
    this._setWorking(false);
    this.fire('app-log', {
      'message': ['Hightligt worker error', e],
      'level': 'error'
    });
    var html = `<arc-error-message>
      <p>${e.message}</p>
    </arc-error-message>`;
    this._display(html);
  }
  /**
   * Handler for worker function after code tokenization.
   *
   * @param {Array} tokens An array of tokens returnet by Prism.
   */
  _onTokenized(tokens) {
    this._setTokenized(tokens);
    this._loadNext();
  }

  /**
   * Display next tokens from `this.tokenized` list - up to `this.maxRead` elements.
   * If after running this function the `this.tokenized` array is empty it will be set to undefined.
   */
  _loadNext() {
    if (!this.tokenized || this.tokenized.length === 0) {
      return;
    }
    var tokens = this.splice('tokenized', 0, this.maxRead);
    var message = {
      'tokens': tokens,
      'payload': 'stringify'
    };
    this._runWorker(message);
    if (this.tokenized.length === 0) {
      this._setTokenized(undefined);
    }
  }

  _loadAll() {
    var tokens = this.tokenized;
    this._setTokenized(undefined);
    var message = {
      'tokens': tokens,
      'payload': 'stringify'
    };
    this._runWorker(message);
  }
  /**
   * Display a HTML code generated by Prism.
   * @param {String} html HTML code to be displayed.
   */
  _display(html) {
    this.$.output.innerHTML += html;
  }

  _computeHasMore(tokenized) {
    if (!tokenized || tokenized.length === 0) {
      return false;
    }
    return true;
  }

  _handleLinks(e) {
    var el = e.target;
    if (el.nodeName !== 'A') {
      return;
    }
    e.preventDefault();

    var url = el.href;
    this.fire('action-link-change', {
      url: url
    });
  }
}
Polymer(PrismHighlight);
})();
