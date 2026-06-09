async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  try {
    await navigator.serviceWorker.register("./service-worker.js");
    console.log("Service worker registrato correttamente.");
  } catch (error) {
    console.warn("Service worker non registrato:", error);
  }
}

async function start() {
  console.log("GymPallao avviata correttamente.");
  await registerServiceWorker();
}

start();
