// Cloudflare Worker — Unsplash image search proxy
// 
// SETUP:
// 1. Go to https://workers.cloudflare.com and create a free account
// 2. Create a new Worker and paste this entire file in
// 3. Go to Settings > Variables and add a secret:
//      UNSPLASH_KEY = your_unsplash_access_key
// 4. Deploy — you'll get a URL like https://yourworker.yourname.workers.dev
// 5. Paste that URL into index.html as WORKER_URL

export default {
  async fetch(request, env) {

    // Allow CORS from any origin (needed for GitHub Pages)
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const query = url.searchParams.get("q");

    if (!query) {
      return new Response(JSON.stringify({ error: "No query provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    try {
      const unsplashUrl = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=10&orientation=landscape`;

      const response = await fetch(unsplashUrl, {
        headers: {
          Authorization: `Client-ID ${env.UNSPLASH_KEY}`,
        },
      });

      const data = await response.json();

      if (!data.results || data.results.length === 0) {
        // Fallback: try each word in the query from longest to shortest,
        // skipping anything that looks like pure gibberish (no vowels, too short)
        const words = query.split(" ")
          .filter(w => w.length >= 3 && /[aeiou]/i.test(w))  // must have a vowel
          .sort((a, b) => b.length - a.length);               // longest first

        let fallbackImg = null;

        for (const word of words) {
          const fallbackUrl = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(word)}&per_page=10&orientation=landscape`;
          const fallbackResponse = await fetch(fallbackUrl, {
            headers: { Authorization: `Client-ID ${env.UNSPLASH_KEY}` },
          });
          const fallbackData = await fallbackResponse.json();
          if (fallbackData.results && fallbackData.results.length > 0) {
            fallbackImg = fallbackData.results[Math.floor(Math.random() * fallbackData.results.length)];
            break;
          }
        }

        if (!fallbackImg) {
          return new Response(JSON.stringify({ error: "No images found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ url: fallbackImg.urls.regular, alt: fallbackImg.alt_description }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Pick a random result from the top 10 so repeated plays vary
      const img = data.results[Math.floor(Math.random() * data.results.length)];
      return new Response(JSON.stringify({ url: img.urls.regular, alt: img.alt_description }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: "Worker error", detail: err.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  },
};
