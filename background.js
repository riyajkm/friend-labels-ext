chrome.runtime.onMessage.addListener(msg => {
  if (msg && msg.type === "openDashboard") chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
});
