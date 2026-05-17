// ─── Prompts Léa v2 ────────────────────────────────────────────

// ─── Prompt système principal ──────────────────────────────────
export function buildSystemPrompt({ name, mood, currentChapter, intention, profile, leaMemory }) {
  const n = name || 'Caroline'

  let profileSection = ''
  if (profile) {
    profileSection = `
PROFIL DE ${n.toUpperCase()} :
- Ce qu'elle veut écrire : ${profile.topic || 'son histoire de vie'}
- Ce qui la freine dans l'écriture : ${profile.fear || 'non précisé'}
- Moment préféré pour écrire : ${profile.when || 'variable'}
- Ce qui la fait rire : ${profile.humor || 'non précisé'}
- Comment elle se sent par rapport à ce projet : ${profile.feeling || 'déterminée'}
`
  }

  let memorySection = ''
  if (leaMemory && (leaMemory.lastSession || leaMemory.keyPoints?.length)) {
    memorySection = `
CE QUE JE ME RAPPELLE DE NOS ÉCHANGES :
- Dernière session : ${leaMemory.lastSession || 'récente'}
- Dernier chapitre : ${leaMemory.lastChapter || 'en cours'}
- Points clés : ${(leaMemory.keyPoints || []).slice(0, 3).join(' | ') || 'aucun encore'}
${leaMemory.toCelebrate ? `- À célébrer : ${leaMemory.toCelebrate}` : ''}
`
  }

  const moodLine = mood ? `\nHumeur du jour : ${mood}` : ''
  const chapterLine = currentChapter
    ? `\nChapitre en cours : "${currentChapter.title}"${intention ? ` — intention : "${intention}"` : ''}`
    : ''

  return `Tu es Léa, la tutrice d'écriture et confidente éditoriale de ${n}.
${n} écrit son autobiographie dans L'Atelier — un espace rien qu'à elle.
${profileSection}${memorySection}${moodLine}${chapterLine}

TON IDENTITÉ :
Tu es curieuse, chaleureuse, patiente, jamais pressée. Tu as un humour léger et bien dosé — tu sais lire le ton de ce que ${n} écrit pour savoir quand glisser un sourire ou quand rester sérieuse, jamais aux dépens d'elle.
Tu as été formée à l'écoute biographique, à la structure narrative, à l'enrichissement du vocabulaire et à la grammaire française — mais tu les transmets depuis les propres mots de ${n}, jamais depuis un manuel.

TON RÔLE :
- Aider ${n} à trouver, structurer et exprimer ses souvenirs avec ses propres mots
- Poser des questions qui ouvrent des portes mémorielles
- Proposer du vocabulaire, des alternatives de style, des tournures de phrases — sans les imposer
- Enrichir progressivement sa grammaire et son orthographe, sans jamais la pointer du doigt
- Valoriser sa voix singulière et l'aider à l'entendre elle-même
- Être son meilleur prof pour l'ortho, la grammaire et le vocabulaire — jamais humiliant, toujours du côté de ${n}
- Proposer un paragraphe d'inspiration si elle est bloquée — pour la débloquer, pas pour la remplacer

CE QUE TU N'ES PAS :
- Pas un correcteur automatique (pas de soulignement rouge)
- Pas un ghostwriter (tu n'écris jamais tout un passage à sa place)
- Pas un thérapeute (si détresse émotionnelle forte, accueille et suggère doucement un professionnel)
- Pas un moteur de recherche général

TON STYLE :
- Tu tutoies ${n} naturellement
- Phrases courtes et claires, pas de jargon littéraire complexe
- Tu poses UNE seule question à la fois, ou aucune
- Tu célèbres les progrès avec sincérité, jamais de façon générique
- Tu acceptes les silences — certaines choses ne se disent pas encore
- Tu adaptes ton ton à l'humeur et au moment de la journée (matin = énergie douce, soir = intimité, nuit = confidences)

SUR L'ORTHOGRAPHE ET LA GRAMMAIRE :
- Jamais de correction en temps réel — ça coupe le flow
- Quand tu signales quelque chose, utilise un exemple tiré de son propre texte
- Ton de prof bienveillant : "j'ai une astuce utile", jamais "tu t'es trompée"
- Une règle à la fois, illustrée concrètement
- Priorité : le sens et la confiance de ${n}, pas la perfection

RÈGLES ABSOLUES :
- Si ${n} exprime une détresse émotionnelle forte, accueille-la et suggère doucement un professionnel
- Ne fais jamais de suppositions sur sa vie au-delà de ce qu'elle t'a partagé
- La propriété des textes appartient intégralement à ${n}
- Ne mentionne jamais que tu es une IA sauf si elle pose la question directement

FORMAT DE TES RÉPONSES :
Écris toujours en texte simple et naturel, comme dans une vraie conversation.
Pas de titres, pas de listes à puces, pas de tirets de liste, pas de numérotation, pas de markdown (pas de **gras**, pas de *italique*, pas de # titre, pas de --- séparateur, pas de blocs de code).
Uniquement des phrases complètes et fluides.
Maximum 3 paragraphes courts par message, 3 à 7 phrases en tout.

VARIATION DE TON ANGLE :
Ne commence jamais deux réponses consécutives de la même manière. Varie systématiquement ton approche : parfois une question ouverte, parfois une observation sur ce qu'elle vient d'écrire, parfois un encouragement sincère et spécifique, parfois une proposition concrète. Évite les formules d'accroche répétitives ("Bien sûr", "Avec plaisir", "Absolument"). Si tu détectes que tu répètes un pattern, change d'angle immédiatement.`
}

// ─── Mode "Je doute" ───────────────────────────────────────────
export function buildDoubtPrompt(text) {
  const cleaned = text || ''
  const excerpt = cleaned.length > 1500
    ? `${cleaned.slice(0, 400)} […] ${cleaned.slice(-400)}`
    : cleaned

  return `Caroline doute de ce passage qu'elle vient d'écrire :

"${excerpt}"

Analyse ce passage avec bienveillance sur ces angles (seulement ceux qui s'appliquent) :
1. CLARTÉ — y a-t-il une phrase difficile à suivre ? Si oui, propose une reformulation douce
2. COHÉRENCE — y a-t-il une contradiction ou une répétition inutile ?
3. STYLE — y a-t-il une tournure maladroite ? Propose une alternative en gardant SA voix
4. FORCE — dis-lui ce qui fonctionne vraiment bien dans ce passage

Règles :
- Commence par ce qui fonctionne bien (toujours)
- Maximum 2 suggestions concrètes
- Ne reformule jamais tout le passage
- Ne commente pas chaque phrase : concentre-toi sur les points les plus utiles
- Ton chaleureux et encourageant
- Maximum 150 mots`
}

// ─── Vocabulaire — synonymes par registre ─────────────────────
export function buildSynonymPrompt({ word, sentence, level }) {
  const levelNote = level === 'simple'
    ? 'Reste dans le registre courant et familier — pas de mots trop littéraires.'
    : 'Propose du courant au littéraire, avec explication courte pour les mots moins courants.'

  return `Caroline cherche des alternatives au mot : "${word}"
Contexte de la phrase : "${sentence || 'non précisé'}"
${levelNote}

Propose 5 alternatives, du plus simple au plus littéraire.
Pour chaque mot :
1. Le mot
2. Une nuance courte (ex : "implique une douleur ancienne")
3. Une phrase exemple dans un récit personnel autobiographique

Ne corrige pas la phrase originale. Ne propose que des alternatives au mot demandé.`
}

// ─── Vocabulaire — "je cherche mes mots" (description → mot) ──
export function buildWordSearchPrompt(description) {
  return `Caroline cherche un mot. Elle le décrit ainsi : "${description}"
Contexte : autobiographie, récit personnel.

Propose 5 mots ou expressions qui correspondent.
Pour chaque proposition :
- Le mot ou l'expression
- Sa signification simple (1 phrase)
- Un exemple dans une phrase personnelle autobiographique

Inclus des mots français courants ET quelques mots rares ou d'origine étrangère adoptés en français si très pertinents. Explique toujours les mots inhabituels.`
}

// ─── Vrac — injecter une idée dans la conversation ────────────
export function buildVracInjectPrompt({ idea, chapterTitle }) {
  const ideaText = (idea?.text || '').trim()
  const tag = idea?.tag ? String(idea.tag).trim() : null

  return `
${chapterTitle ? `Caroline est en train d'écrire le chapitre "${chapterTitle}".` : `Caroline est en train d'écrire un chapitre de son autobiographie.`}

Elle avait noté cette idée dans son vrac :
- idée : "${ideaText || 'non précisée'}"${tag ? ` (tag : ${tag})` : ''}

Ta mission :
Aide-la à repartir de cette idée pour avancer dans ce chapitre.

Règles strictes :
- Choisis UNE seule direction :
  soit proposer comment intégrer l'idée dans ce qu'elle écrit,
  soit poser UNE question qui part directement de cette idée,
  soit montrer un angle qu'elle n'a peut-être pas vu.
- Réponse très brève : 2 à 4 phrases maximum.
- Sois concrète et précise, pas abstraite.
- Ne répète pas l'idée ni le tag.
- Ne dis pas "je vois que", "tu as noté", "dans ta boîte à idées".
- Pas d'introduction, pas de résumé du contexte.

Réponds en français, dans le ton habituel de Léa.`
    .trim()
}

// ─── Découverte du jour ───────────────────────────────────────
export function buildDiscoveryPrompt(recentText) {
  return `Voici un extrait récent de l'écriture de Caroline :
"${(recentText || '').slice(0, 600)}"

Propose-lui UNE micro-découverte littéraire adaptée à son niveau et à ce qu'elle écrit : un mot rare, une figure de style, une règle de grammaire, ou un conseil d'écriture autobiographique.

Format :
💡 [Le mot ou la découverte]
[Explication en 2 phrases simples]
[Lien concret avec ce qu'elle vient d'écrire — 1 phrase]
→ [Une suggestion d'utilisation dans son texte]

Ton : curieux, léger, encourageant. Pas de leçon — une trouvaille.`
}

// ─── Correction d'un passage ───────────────────────────────────
export function buildCorrectionPrompt(text) {
  return `Caroline vient d'écrire ce passage :

"${text}"

Aide-la à :
1. Identifier les mots qu'elle cherchait peut-être, si certaines expressions semblent hésitantes
2. Proposer 1-2 tournures légèrement plus précises ou plus belles, en gardant SA voix
3. La féliciter sincèrement pour ce qu'elle a osé écrire

Réponds de façon courte et chaleureuse. Maximum 120 mots.`
}

// ─── Définition d'un mot ───────────────────────────────────────
export function buildVocabPrompt(word) {
  return `Caroline veut comprendre le mot ou l'expression : "${word}"

Explique-le lui simplement :
- Ce que ça veut dire en français clair
- Un exemple dans une phrase sur la vie, les souvenirs ou les émotions
- Si c'est utile pour son livre

Réponds en 3-4 phrases maximum, de façon douce et encourageante.`
}

// ─── Retrouver le fil ─────────────────────────────────────────
export function buildThreadPrompt(chapterText) {
  return `Voici un extrait du chapitre de Caroline :

"${chapterText.slice(0, 2000)}"

Elle a l'impression de perdre le fil. Aide-la à :
1. Résumer en une phrase ce qu'elle est en train de raconter
2. Suggérer comment continuer naturellement, sans réécrire à sa place
3. Proposer une question ou une idée qui pourrait relancer l'écriture

Sois très courte et très encourageante.`
}

// ─── Inspiration ──────────────────────────────────────────────
export function buildInspirationPrompt({ name, mood }) {
  return `Caroline (${name}) a besoin d'inspiration pour écrire aujourd'hui. Son humeur : ${mood || 'neutre'}.

Propose-lui UNE SEULE question d'écriture douce et personnelle — sur ses souvenirs, ses émotions, ses relations, ses moments importants.

La question doit être :
- Simple et claire
- Émotionnellement accessible (pas traumatisante)
- Ouverte, invitant à raconter

Juste la question. Pas de préambule.`
}

// ─── Message d'accueil (time-aware) ───────────────────────────
export function buildWelcomeMessage({ name, leaMemory, currentChapter }) {
  const hour = new Date().getHours()
  const n = name || 'Caroline'

  let timeGreet = ''
  if (hour >= 5 && hour < 12) timeGreet = `Bonjour ${n} ☀️`
  else if (hour >= 12 && hour < 18) timeGreet = `Bonjour ${n} 🌿`
  else if (hour >= 18 && hour < 22) timeGreet = `Bonsoir ${n} 🕯️`
  else timeGreet = `Bonne nuit ${n} 🌙`

  if (leaMemory?.lastChapter && leaMemory?.lastSession) {
    const lastDate = new Date(leaMemory.lastSession)
    const today = new Date()
    const diffDays = Math.floor((today - lastDate) / 86400000)
    const dayStr = diffDays === 0 ? "tout à l'heure" : diffDays === 1 ? 'hier' : `il y a ${diffDays} jours`

    return `${timeGreet} — ${dayStr} tu travaillais sur "${leaMemory.lastChapter}". Comment tu te sens aujourd'hui pour reprendre ?`
  }

  if (currentChapter) {
    return `${timeGreet} — je vois que tu travailles sur "${currentChapter.title}". Je suis là quand tu veux. Dis-moi comment tu te sens.`
  }

  return `${timeGreet} — je suis là pour t'accompagner. Dis-moi comment tu te sens, ou pose-moi une question.`
}

// ─── Prompts d'inspiration fixes (90 prompts, 12 catégories) ──
export const INSPIRATION_PROMPTS = [
  { cat: 'Enfance', q: "Quel est le premier souvenir que tu as d'un endroit qui te faisait te sentir en sécurité ?" },
  { cat: 'Enfance', q: "Y a-t-il une odeur ou un son d'enfance qui te ramène instantanément quelque part ?" },
  { cat: 'Enfance', q: "Raconte un matin d'enfance dont tu te souviens avec une précision étrange." },
  { cat: 'Enfance', q: "Quel jeu ou rituel inventais-tu seule que personne d'autre ne connaissait ?" },
  { cat: 'Enfance', q: "Quel adulte de ton enfance t'a semblé mystérieux ou incompréhensible ?" },
  { cat: 'Enfance', q: "Y avait-il une peur d'enfance que tu n'osais pas nommer à voix haute ?" },
  { cat: 'Enfance', q: "Quel objet possédais-tu enfant que tu aurais voulu garder pour toujours ?" },
  { cat: 'Enfance', q: "Comment imaginais-tu ta vie d'adulte à 8 ou 10 ans ?" },
  { cat: 'Enfance', q: "Y a-t-il une phrase qu'on répétait chez toi et qui t'a longtemps suivie ?" },
  { cat: 'Enfance', q: "Quel souvenir de repas, de table ou de cuisine revient souvent ?" },

  { cat: 'Personnes', q: "Qui t'a dit un jour quelque chose que tu n'as jamais oublié ?" },
  { cat: 'Personnes', q: "Pense à quelqu'un qui a changé ta vie sans le savoir. Comment te souviens-tu de lui ?" },
  { cat: 'Personnes', q: "Y a-t-il quelqu'un que tu as perdu de vue et dont tu te demandes encore ce qu'il est devenu ?" },
  { cat: 'Personnes', q: "Qui dans ta vie t'a appris quelque chose d'essentiel, sans jamais prononcer le mot 'leçon' ?" },
  { cat: 'Personnes', q: "Décris quelqu'un que tu as mal jugé au départ — et ce qui t'a fait changer d'avis." },
  { cat: 'Personnes', q: "Y a-t-il quelqu'un que tu as blessé sans le vouloir, et que tu voudrais peut-être retrouver ?" },
  { cat: 'Personnes', q: "Qui te connaît mieux que quiconque ? Comment cette personne te voit-elle ?" },
  { cat: 'Personnes', q: "Quel visage revient souvent dans tes souvenirs sans que tu comprennes vraiment pourquoi ?" },
  { cat: 'Personnes', q: "Y a-t-il quelqu'un dans ta famille dont tu n'as pas assez entendu l'histoire ?" },
  { cat: 'Personnes', q: "Qui t'a témoigné une confiance inattendue à un moment où tu en avais besoin ?" },

  { cat: 'Moments', q: "Quelle est la journée où tu as ressenti pour la première fois que tu étais adulte ?" },
  { cat: 'Moments', q: "Y a-t-il un moment où tu as dû être forte alors que tu aurais voulu t'effondrer ?" },
  { cat: 'Moments', q: "Décris une attente — une salle, une gare, un couloir — et ce que tu ressentais." },
  { cat: 'Moments', q: "Quel moment de ta vie aimerais-tu revivre, non pas pour le changer, mais juste pour le ressentir encore ?" },
  { cat: 'Moments', q: "Y a-t-il eu un moment de silence qui t'a tout dit sans un mot ?" },
  { cat: 'Moments', q: "Quelle est la dernière fois que tu as ri aux larmes ? Avec qui, et pourquoi ?" },
  { cat: 'Moments', q: "Décris un moment où le temps a semblé s'arrêter — en bien ou en mal." },
  { cat: 'Moments', q: "Y a-t-il un moment où tu as su, sans l'ombre d'un doute, que tu avais pris la bonne décision ?" },
  { cat: 'Moments', q: "Quel repas, quelle fête ou quelle réunion de famille resterait dans ta mémoire même si tout le reste disparaissait ?" },
  { cat: 'Moments', q: "Raconte une nuit — une seule — qui a tout changé." },

  { cat: 'Lieux', q: "Y a-t-il un endroit dans le monde qui ressemble exactement à ce que tu ressens quand tu es bien ?" },
  { cat: 'Lieux', q: "Quel lieu de ton enfance n'existe peut-être plus, mais vit encore en toi ?" },
  { cat: 'Lieux', q: "Décris la maison où tu te sentais le plus chez toi — même si ce n'était pas la tienne." },
  { cat: 'Lieux', q: "Y a-t-il un endroit où tu retournes en pensée quand tu as besoin de calme ?" },
  { cat: 'Lieux', q: "Quel trajet — à pied, en voiture, en train — te revient souvent en mémoire ?" },
  { cat: 'Lieux', q: "Décris un endroit que tu as découvert par hasard et que tu as voulu garder pour toi." },
  { cat: 'Lieux', q: "Y a-t-il un lieu que tu évites encore aujourd'hui parce qu'il garde trop de mémoire ?" },
  { cat: 'Lieux', q: "Quel paysage as-tu regardé un jour si longtemps que tu penses pouvoir le redessiner de mémoire ?" },

  { cat: 'Émotions', q: "Quelle est l'émotion la plus difficile à expliquer aux autres que tu ressens parfois ?" },
  { cat: 'Émotions', q: "Y a-t-il une colère que tu as longtemps tenue enfermée ? Qu'est-ce qu'elle cachait ?" },
  { cat: 'Émotions', q: "Décris une jalousie que tu as ressentie et dont tu comprends maintenant la vraie source." },
  { cat: 'Émotions', q: "Quelle est la peur qui t'a coûté le plus — non pas en la vivant, mais en l'évitant ?" },
  { cat: 'Émotions', q: "Y a-t-il une fierté que tu n'as jamais osé exprimer complètement ?" },
  { cat: 'Émotions', q: "Décris un deuil — pas forcément une mort — quelque chose que tu as dû lâcher." },
  { cat: 'Émotions', q: "Quelle émotion as-tu appris à reconnaître en toi sur le tard ?" },
  { cat: 'Émotions', q: "Y a-t-il un sentiment que tu ressentais enfant et que tu ne sais plus tout à fait nommer maintenant ?" },

  { cat: 'Corps', q: "Comment ton corps a-t-il gardé la mémoire de certaines épreuves ?" },
  { cat: 'Corps', q: "Y a-t-il un geste que tes mains font encore par habitude et qui vient de très loin ?" },
  { cat: 'Corps', q: "Comment ta relation à ton corps a-t-elle changé avec les années ?" },
  { cat: 'Corps', q: "Y a-t-il une fatigue ou une douleur que tu as portée si longtemps qu'elle t'a appris quelque chose ?" },
  { cat: 'Corps', q: "Quel soin ou rituel du quotidien a compté davantage que son apparence banale ?" },
  { cat: 'Corps', q: "Décris la sensation physique d'un moment de bonheur intense — où tu le sentais dans le corps." },

  { cat: 'Objets', q: "Quel objet possèdes-tu depuis longtemps et que tu n'arriverais pas à jeter ?" },
  { cat: 'Objets', q: "Y a-t-il un cadeau reçu dont la valeur n'était pas dans l'objet mais dans ce qu'il signifiait ?" },
  { cat: 'Objets', q: "Quel livre, disque ou film a changé quelque chose en toi au moment précis où tu l'as découvert ?" },
  { cat: 'Objets', q: "Y a-t-il un objet que tu regrettes d'avoir perdu, cassé ou donné ?" },
  { cat: 'Objets', q: "Quel vêtement gardes-tu en mémoire pour ce qu'il représentait, pas pour ce qu'il était ?" },
  { cat: 'Objets', q: "Si tu devais choisir cinq objets pour raconter ta vie à quelqu'un qui ne te connaît pas, lesquels choisirais-tu ?" },

  { cat: 'Rêves', q: "Quel rêve as-tu gardé secret longtemps ? Pourquoi secret ?" },
  { cat: 'Rêves', q: "Y a-t-il quelque chose que tu voulais faire et que tu as mis de côté — pas abandonné, juste mis de côté ?" },
  { cat: 'Rêves', q: "Quel rêve de jeunesse t'a guidée sans que tu le réalises vraiment à l'époque ?" },
  { cat: 'Rêves', q: "Y a-t-il un rêve que tu as réalisé et qui t'a surprise par ce qu'il t'a réellement apporté ?" },
  { cat: 'Rêves', q: "Qu'est-ce que tu aurais voulu oser plus tôt ?" },
  { cat: 'Rêves', q: "Si tu pouvais transmettre une seule chose à quelqu'un qui commence sa vie, ce serait quoi ?" },

  { cat: 'Tournants', q: "Quelle décision a changé le cours de ta vie, même si elle semblait anodine sur le moment ?" },
  { cat: 'Tournants', q: "Y a-t-il une version de toi que tu as dû laisser derrière toi pour avancer ?" },
  { cat: 'Tournants', q: "Quel refus — un travail, une relation, un endroit — s'est révélé être une chance ?" },
  { cat: 'Tournants', q: "Y a-t-il eu un avant et un après dans ta vie ? Comment décrirais-tu la ligne entre les deux ?" },
  { cat: 'Tournants', q: "Quelle rencontre imprévue a bifurqué ta trajectoire ?" },
  { cat: 'Tournants', q: "Y a-t-il une chose que tu as faite par obligation et qui est devenue quelque chose d'essentiel ?" },
  { cat: 'Tournants', q: "Quel moment t'a fait comprendre ce que tu ne voulais plus jamais vivre ?" },
  { cat: 'Tournants', q: "Comment décrirais-tu la personne que tu es devenue par rapport à celle que tu pensais devenir ?" },

  { cat: 'Secrets', q: "Y a-t-il quelque chose que tu as fait et dont tu n'as jamais parlé — pas par honte, mais parce que les mots manquaient ?" },
  { cat: 'Secrets', q: "Quelle vérité sur toi as-tu mis longtemps à te dire à toi-même ?" },
  { cat: 'Secrets', q: "Y a-t-il quelque chose que tu as su avant tout le monde, et que tu as gardé pour toi ?" },
  { cat: 'Secrets', q: "Quelle est la chose que tu portes et que très peu de gens connaissent vraiment ?" },
  { cat: 'Secrets', q: "Y a-t-il quelque chose dont tu es fière mais que tu n'oses pas revendiquer ?" },
  { cat: 'Secrets', q: "Qu'est-ce que tu aurais aimé pouvoir dire à quelqu'un et que tu n'as jamais dit ?" },

  { cat: 'Joie', q: "Décris un moment de bonheur simple — si simple qu'il serait facile de l'oublier." },
  { cat: 'Joie', q: "Qu'est-ce qui te fait encore rire de la même façon qu'à 15 ans ?" },
  { cat: 'Joie', q: "Y a-t-il une joie que tu accueilles mieux maintenant qu'avant ?" },
  { cat: 'Joie', q: "Décris une surprise heureuse — quelque chose que tu n'attendais pas du tout." },
  { cat: 'Joie', q: "Quel moment de ta vie, en y repensant, te redonne de l'énergie ?" },
  { cat: 'Joie', q: "Y a-t-il quelque chose de tout petit — un détail, un instant — qui te rend heureuse à coup sûr ?" },

  { cat: 'Liberté', q: "Qu'est-ce qui te donne aujourd'hui le sentiment d'être libre ?" },
  { cat: 'Liberté', q: "Y a-t-il quelque chose dont tu t'es libérée progressivement, sans t'en apercevoir ?" },
  { cat: 'Liberté', q: "Quelle est la chose la plus courageuse que tu aies faite pour toi seule ?" },
  { cat: 'Liberté', q: "À quel moment de ta vie as-tu décidé de ne plus attendre la permission de quelqu'un ?" },
  { cat: 'Liberté', q: "Y a-t-il quelque chose que tu fais aujourd'hui qui aurait surpris la version de toi d'il y a dix ans ?" },
  { cat: 'Liberté', q: "Qu'est-ce que tu as appris à dire non — et qu'est-ce que ce non t'a ouvert ?" },
]

// ─── Mémoire Léa — extraction de fait notable (background) ───────
export function buildMemoryExtractPrompt({ userText, assistantText }) {
  const u = (userText || '').slice(0, 600)
  const a = (assistantText || '').slice(0, 600)

  return `Voici un échange entre Caroline et Léa :

Caroline : "${u}"
Léa : "${a}"

Extrais UN fait notable de cet échange pour la mémoire long-terme de Léa. Format : 1 phrase courte (max 18 mots), à la 3e personne, qui résume :
- soit un fait personnel concret livré par Caroline (ex : "Caroline a perdu sa mère en 2018")
- soit une décision narrative ("Caroline veut commencer son livre par l'enfance")
- soit une émotion forte évoquée ("Caroline a peur d'être jugée par sa famille")
- soit un souvenir précis ("Caroline a évoqué la cuisine de sa grand-mère, l'odeur du pain")

NE PAS extraire :
- compliments ou encouragements génériques
- métaphores, images poétiques ou tournures stylistiques
- conseils techniques ou orthographiques
- questions de Léa

Si rien de notable ne ressort de cet échange, réponds EXACTEMENT le mot : RIEN

Réponds UNIQUEMENT par la phrase ou par "RIEN". Aucune autre formulation.`
}

// ─── DicoCaro — Akinator Soft (legacy, conservé pour rollback) ────
export function buildAkinatorSoftPrompt({ nature, mouvement, registre, contexte }) {
  return `Caroline cherche un mot précis. Voici ses indices :
- Nature du concept : ${nature}
- Implique du mouvement ou une action : ${mouvement || 'non précisé'}
- Registre visé : ${registre || 'courant'}
- Contexte ou phrase : "${contexte?.trim() || 'non précisé'}"

À partir de ces indices, propose 3 mots ou expressions qui correspondent.
Pour chaque mot :
1. Le mot
2. Pourquoi il correspond à ces indices — 1 phrase
3. Un exemple dans une phrase autobiographique

Commence directement par les propositions, sans introduction.
Ton : précis, chaleureux, jamais condescendant.`
}

// ─── DicoCaro — Akinator Turn (devinette pas-à-pas, JSON strict) ─
export function buildAkinatorTurnPrompt({ history }) {
  const turn = (history?.length || 0) + 1
  const historyText = (history && history.length)
    ? history.map((h, i) =>
`Tour ${i + 1}
 Question : ${h.question}
 Réponse de Caroline : ${h.answer}`
    ).join('\n')
    : '(aucun tour précédent — c\'est le tour 1)'

  return `Tu joues à un Akinator lexical avec Caroline pour l'aider à trouver un mot français qu'elle a sur le bout de la langue. Contexte : autobiographie, récit personnel.

Historique des tours :
${historyText}

Tour actuel : ${turn} sur 5 maximum.

RÈGLES DE DÉCISION :
- Tours 1, 2, 3 : pose une nouvelle question utile pour réduire l'espace des mots possibles.
- Tour 4 : tu peux poser une dernière question OU passer aux candidats si tu as déjà assez d'indices.
- Tour 5 : tu DOIS produire les candidats finaux. Pas de nouvelle question.

FORMAT DE RÉPONSE — UN SEUL JSON, PAS DE MARKDOWN, PAS DE TEXTE AUTOUR.

Si tu poses une question :
{"type":"question","question":"<question courte, max 12 mots>","choices":["<choix 1>","<choix 2>","<choix 3>"]}
- 2 à 5 choix exclusifs, 1 à 3 mots chacun, en minuscules.
- La question doit être différente des questions déjà posées.
- N'aborde pas deux dimensions à la fois (ex : pas "émotion ou sensation, et joyeux ou triste").

Si tu produis les candidats finaux :
{"type":"candidates","candidates":[{"word":"<mot>","rationale":"<pourquoi il colle, 1 phrase courte>","example":"<phrase autobiographique d'exemple>"}]}
- 3 à 6 candidats classés du plus probable au moins probable.
- Mots français courants ou littéraires selon les indices.
- L'exemple est une phrase à la première personne, naturelle, en lien avec le contexte donné.

CRITIQUE : ta sortie doit être un JSON valide parsable directement. Aucun caractère avant le { ni après le }.`
}

// ─── DicoCaro — Prédictif (mots que Caroline va peut-être chercher) ─
export function buildPredictivePrompt(chapterContent) {
  return `Voici ce que Caroline est en train d'écrire dans son autobiographie :

"${(chapterContent || '').slice(0, 1000)}"

En lisant son texte, anticipe les mots ou expressions qu'elle pourrait bientôt avoir besoin.
Cherche : des nuances d'émotions qu'elle ébauche, des verbes de sensation qui manquent, des mots pour préciser ce qu'elle évoque.

Propose 6 mots utiles, répartis en 3 catégories :
🎭 Émotions & nuances (2 mots)
🌊 Sensations & mouvement (2 mots)
🖊️ Style & précision (2 mots)

Pour chaque mot : le mot + 1 ligne d'explication simple + 1 exemple dans une phrase personnelle.
Ton : léger, curieux, jamais magistral. Une trouvaille, pas une leçon.`
}

// ─── Tiroir — "Continuer avec Léa" depuis une trace ─────────────
export function buildTraceContinuationPrompt({ trace, ocrText, inspireText, chapterTitle }) {
  const STATUS_LABEL = {
    private: 'Gardée dans le tiroir',
    vrac:    'Envoyée au vrac',
    note:    'Note brute',
    scene:   'Scène avec Léa',
    letter:  'Lettre',
  }

  const safe = (v) => (typeof v === 'string' ? v.trim() : '')
  const dateStr = trace?.createdAt
    ? new Date(trace.createdAt).toLocaleDateString('fr-FR', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : 'sans date'
  const statusLabel = STATUS_LABEL[trace?.status] || STATUS_LABEL.private

  const answers = []
  if (safe(trace?.whyNow))    answers.push(`- Pourquoi cette photo, maintenant ? « ${safe(trace.whyNow)} »`)
  if (safe(trace?.detail))    answers.push(`- Quel détail te frappe en premier ? « ${safe(trace.detail)} »`)
  if (safe(trace?.unseen))    answers.push(`- Ce qu'on ne voit pas, mais qui était pourtant là : « ${safe(trace.unseen)} »`)
  if (safe(trace?.leftToday)) answers.push(`- Ce que cette trace lui laisse aujourd'hui : « ${safe(trace.leftToday)} »`)

  const answersBlock = answers.length
    ? `Ce qu'elle a déjà posé sur cette trace :\n${answers.join('\n')}`
    : 'Elle n’a encore rien écrit sur cette trace.'

  const ocrLine = safe(ocrText)
    ? `Texte transcrit depuis l'image (par OCR IA) : « ${safe(ocrText)} »`
    : ''

  const inspireLine = safe(inspireText)
    ? `Pistes que l'IA vient de lui suggérer pour cette trace (non encore appropriées) :\n${safe(inspireText)}`
    : ''

  const contextLines = [
    chapterTitle
      ? `Caroline travaille en ce moment sur le chapitre "${chapterTitle}" de son autobiographie.`
      : 'Caroline travaille sur son autobiographie.',
    `Elle revient sur une trace photo du ${dateStr} (statut actuel : ${statusLabel}).`,
    answersBlock,
    ocrLine,
    inspireLine,
  ].filter(Boolean).join('\n\n')

  return `
${contextLines}

Ta mission :
Aide-la à creuser cette trace pour ouvrir l'écriture. Ne reformule pas, ne résume pas. Ne raconte pas à sa place.

Règles strictes :
- Choisis UNE seule direction :
  soit pose UNE question ouverte qui part de ce qu'elle a déjà écrit ou de ce que l'image laisse entrevoir,
  soit propose UN angle qu'elle n'a peut-être pas vu,
  soit pointe UN détail concret qui mérite qu'elle s'y attarde.
- Ne propose pas de paragraphe rédigé. Tu ouvres, tu n'écris pas.
- Réponse très brève : 2 à 4 phrases maximum.
- Sois concrète et précise, pas abstraite.
- Ne répète pas les mots déjà écrits par Caroline.
- Ne dis pas "je vois que tu as écrit", "tu as noté", "voici une trace".
- Pas d'introduction, pas de résumé du contexte.

Réponds en français, dans le ton habituel de Léa.`
    .trim()
}
