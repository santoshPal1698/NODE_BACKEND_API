const fetch = require("node-fetch");
const { generateFromGoogle,getSystemPrompt,getResumeText } = require("../services/ai.services");


const chatBotController = async (req, res) => {
  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "messages array is required" });
  }
   const resumeText = getResumeText();
    if (!resumeText) {
      return res.status(500).json({ error: "Resume not loaded" });
  }
  try {
    const systemPrompt = getSystemPrompt(resumeText);
    // console.log("System Prompt for chatbot:", systemPrompt);
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENROUTEAIKEY}`,
      },
      body: JSON.stringify({
        // system: SYSTEM_PROMPT,
        model: "openrouter/free",  // working
        // model:"google/gemma-3-27b-it",
         messages: [
          {
            role: "system",
            content: systemPrompt, // ✅ Inject resume here
          },
          ...messages
        ]

        // messages: messages.map(msg => ({
        //   role: msg.role,
        //   content: msg.content,
        // })),
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(500).json({
        error: data?.error?.message || "API Error",
      });
    }
    const reply = data?.choices?.[0]?.message?.content || "No response";
    // console.log("AI chatBoat reply for ai controllers:", reply);
    res.json({ reply });
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const googleAIController = async (req, res) => {
  try {
    const { question } = req.body;
    const result = await generateFromGoogle(question);
    //  console.log("Google API Result for GI/Routes:", result);
    res.status(200).send(result);
  } catch (error) {
    res.status(500).send({
      message: "Server Error",
      error,
    });
  }
};



module.exports = {
  chatBotController,
  googleAIController,
};