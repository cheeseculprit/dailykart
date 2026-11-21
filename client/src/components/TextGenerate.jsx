import { motion, useReducedMotion } from 'motion/react';

/*
 * Words appear one by one, fading in from a blur, after Aceternity UI's
 * Text Generate Effect (ui.aceternity.com/components/text-generate-effect).
 * `lines` is an array of strings; each starts on a new line.
 * Screen readers get the plain sentence; the animated words are hidden from them.
 */
export default function TextGenerate({ as: Tag = 'h2', lines, className = '', stagger = 0.12, duration = 0.5, delay = 0.1 }) {
  const reduce = useReducedMotion();
  let i = 0;

  return (
    <Tag className={className} aria-label={lines.join(' ')}>
      {lines.map((line, li) => (
        <span key={li} aria-hidden="true">
          {li > 0 && <br />}
          {line.split(' ').map((word, wi) => {
            const n = i++;
            return (
              <motion.span
                key={wi}
                className="inline-block"
                initial={reduce ? false : { opacity: 0, filter: 'blur(10px)', y: 4 }}
                animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
                transition={{ duration, delay: delay + n * stagger, ease: 'easeOut' }}
              >
                {word}
                {wi < line.split(' ').length - 1 && ' '}
              </motion.span>
            );
          })}
        </span>
      ))}
    </Tag>
  );
}
