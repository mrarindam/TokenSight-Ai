const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN
const DISCORD_APPLICATION_ID = process.env.DISCORD_APPLICATION_ID

if (!DISCORD_BOT_TOKEN || !DISCORD_APPLICATION_ID) {
  console.error("❌ Error: Missing DISCORD_BOT_TOKEN or DISCORD_APPLICATION_ID in env")
  process.exit(1)
}

const commands = [
  {
    name: "start",
    description: "Start the TokenSight AI bot and get your Discord ID",
    integration_types: [0, 1],
    contexts: [1], // Only available in Bot DMs
  },
  {
    name: "help",
    description: "Show list of available commands",
    integration_types: [0, 1],
    contexts: [0, 1, 2], // Available in Guilds, Bot DMs, and Private Channels
  },
  {
    name: "scan",
    description: "Scan a Solana token address",
    integration_types: [0, 1],
    contexts: [0, 1, 2], // Available in Guilds, Bot DMs, and Private Channels
    options: [
      {
        name: "address",
        description: "The Solana token contract address",
        type: 3, // String type
        required: true,
      },
    ],
  },
  {
    name: "alerts",
    description: "View your active price alerts",
    integration_types: [0, 1],
    contexts: [1], // Only available in Bot DMs
  },
]

async function registerCommands() {
  const url = `https://discord.com/api/v10/applications/${DISCORD_APPLICATION_ID}/commands`
  
  console.log(`⏳ Registering slash commands for App ID ${DISCORD_APPLICATION_ID}...`)

  try {
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(commands),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error("❌ Failed to register commands:", data)
      process.exit(1)
    }

    console.log("✅ Successfully registered Discord slash commands:")
    data.forEach((cmd) => {
      console.log(`   - /${cmd.name} (ID: ${cmd.id})`)
    })
  } catch (err) {
    console.error("❌ Request error:", err)
    process.exit(1)
  }
}

registerCommands()
