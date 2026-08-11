const TEXT_ENTRY_TYPES = new Set(['over', 'regex', 'text']);

export function createUtoolsAdapter(api = globalThis.utools) {
  return {
    onTextEnter(callback) {
      if (typeof api?.onPluginEnter !== 'function') return;

      api.onPluginEnter(({ type, payload } = {}) => {
        if (TEXT_ENTRY_TYPES.has(type) && typeof payload === 'string') {
          callback(payload);
        }
      });
    },

    copyText(text) {
      if (typeof api?.copyText !== 'function') return false;
      return api.copyText(text) === true;
    },
  };
}
