// Voice transcription endpoint
// - Note: MVP uses Web Speech API (browser-native, client-side only)
// - This route is a placeholder for potential server-side fallback
// - No external API needed — Web Speech API handles STT in the browser

export async function POST(_req: Request) {
  // TODO: implement server-side transcription fallback if needed
  return new Response("Not implemented", { status: 501 });
}