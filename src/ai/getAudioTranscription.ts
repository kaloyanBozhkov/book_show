import { getOpenAISFWInstance } from "./openai";

export const getAudioTranscription = async (audioFileUrl: string) => {
  console.log("audioFileUrl", audioFileUrl);
  const openai = getOpenAISFWInstance();
  const file = await fetch(audioFileUrl);
  const fileBlob = await file.blob();
  const namedBlob = new Blob([fileBlob], { type: fileBlob.type });
  // @ts-ignore
  namedBlob.name = "userAudio.m4a";
  const transcription = await openai.audio.transcriptions.create({
    file: namedBlob,
    model: "gpt-4o-transcribe",
    response_format: "text",
  });
  return transcription;
};
