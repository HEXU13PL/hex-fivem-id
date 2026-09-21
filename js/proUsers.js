
export const PRO_DISCORD_IDS = [
    // '123456789012345678',
];

export const isConfiguredProUser = (discordId) =>
    PRO_DISCORD_IDS.includes(String(discordId || ''));
