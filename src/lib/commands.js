// ─── Commandes Léa — textes centralisés ───────────────────────
// Toutes les instructions envoyées programmatiquement à Léa
// passent par ici. Jamais de chaîne inline dans les composants.

export const LEA_COMMANDS = {
  // Léa relit le chapitre en cours et donne son ressenti
  RELIRE: (content) =>
    `Lis ce que j'ai écrit et dis-moi ce que tu en penses : "${(content || '').slice(0, 600)}"`,

  // Léa aide à retrouver le fil narratif
  RETROUVER_FIL: (content) =>
    `J'ai l'impression de perdre le fil. Résume en une phrase ce que je suis en train de raconter, et suggère comment continuer : "${(content || '').slice(0, 800)}"`,

  // Demande d'inspiration directe à Léa
  INSPIRATION: () =>
    `J'ai besoin d'une question d'inspiration pour écrire. Pose-m'en une seule, douce et personnelle.`,

  // Léa célèbre un progrès (appelé après une session productive)
  CELEBRATE: (wordCount) =>
    `Je viens d'écrire. Aujourd'hui j'ai ${wordCount} mots. Dis-moi quelque chose d'encourageant — sincèrement, pas de façon générique.`,
}
