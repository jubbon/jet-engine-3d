import en from './en.js';
import ru from './ru.js';
import es from './es.js';
import zhHans from './zh-Hans.js';
import fr from './fr.js';
import ptBR from './pt-BR.js';
import de from './de.js';
import ja from './ja.js';

/* The order is declared here rather than left to object-key iteration,
 * because it is the order the switcher shows. English first as the source
 * language; the rest by the size of the audience the model is likely to
 * reach, with French ahead of its share because the prototype CFM56-7B is a
 * GE/Safran engine and the French side is the primary source behind half the
 * reference data in docs/engines. */
export default { en, ru, es, 'zh-Hans': zhHans, fr, 'pt-BR': ptBR, de, ja };
