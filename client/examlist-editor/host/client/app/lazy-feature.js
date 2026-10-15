const styles = new Map();

export function loadFeatureStyles(url) {
  if (!url) return Promise.resolve();
  if (!styles.has(url)) {
    styles.set(url, new Promise((resolve, reject) => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = url;
      link.onload = resolve;
      link.onerror = () => { link.remove(); styles.delete(url); reject(new Error("화면 스타일을 불러오지 못했습니다.")); };
      document.head.append(link);
    }));
  }
  return styles.get(url);
}

// Keep guard callbacks synchronous; initialize a feature explicitly before its view opens.
export function createLazyActions(initialize) {
  let actions = null;
  let pending = null;
  const methods = new Map();
  function load() {
    if (!pending) pending = Promise.resolve().then(initialize).then(value => { actions = value; }).catch(error => { pending = null; throw error; });
    return pending;
  }
  return new Proxy({}, {
    get(_target, name) {
      if (name === "load") return load;
      if (name === "then") return undefined;
      if (!methods.has(name)) methods.set(name, (...args) => actions?.[name]?.(...args));
      return methods.get(name);
    },
  });
}
