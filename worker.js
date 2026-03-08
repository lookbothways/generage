export default {
  async fetch(request, env, ctx) {
    // 1. Handle CORS so your frontend is allowed to talk to this Worker
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        }
      });
    }

    const url = new URL(request.url);
    const userPrompt = url.searchParams.get("q");
    
    // 2. Handle the "warmup" ping your HTML sends on load
    if (userPrompt === "warmup") {
      return new Response(JSON.stringify({ status: "warm" }), {
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*" 
        }
      });
    }

    // Helper to build the Pollinations AI image URL
    const buildImageUrl = (promptText) => {
      // Use a random seed so it generates a fresh image every time
      const seed = Math.floor(Math.random() * 100000);
      return `https://image.pollinations.ai/prompt/${encodeURIComponent(promptText)}?width=500&height=300&nologo=true&seed=${seed}`;
    };

    let finalPrompt = userPrompt || "empty void of failure";
    let targetUrl = buildImageUrl(finalPrompt);
    let finalImageUrl = targetUrl;

    try {
      // 3. Test the generated image to make sure the AI didn't fail or block the prompt
      // We only wait for the headers to return so we don't waste worker memory downloading the image
      let imageResponse = await fetch(targetUrl);
      const contentType = imageResponse.headers.get("content-type") || "";
      const isValidImage = imageResponse.ok && contentType.startsWith("image/");

      // 4. IF IT FAILED -> Fallback to "look both ways"
      if (!isValidImage) {
        console.log(`Failed! Swapping "${finalPrompt}" for "look both ways".`);
        finalImageUrl = buildImageUrl("look both ways");
      }
    } catch (err) {
      // If the fetch completely crashes (timeout, DNS issue), use the fallback
      finalImageUrl = buildImageUrl("look both ways");
    }

    // 5. Return JSON exactly how your index.html expects it
    return new Response(JSON.stringify({ url: finalImageUrl }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
};