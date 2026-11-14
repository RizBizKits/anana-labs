import "./style.css";

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
  <main class="home">
    <h1 class="brand">anana labs</h1>
    <nav class="home-versions" aria-label="Versions">
      <a class="home-version" href="/v1.html">v1</a>
      <a class="home-version" href="/animator.html">v2</a>
    </nav>
  </main>
`;
