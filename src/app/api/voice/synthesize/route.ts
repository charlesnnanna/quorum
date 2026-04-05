// Voice synthesis endpoint
// - Note: MVP uses Web Speech Synthesis API (browser-native, client-side only)
// - This route is a placeholder for potential server-side fallback
// - No external API needed — SpeechSynthesis handles TTS in the browser

export async function POST(_req: Request) {
  // TODO: implement server-side synthesis fallback if needed
  return new Response("Not implemented", { status: 501 });
}