import { useTranslation } from 'react-i18next';

// Design step 9: a simple progress line: Received > Confirmed > On the way > Delivered.
// "processing" (being prepared) sits inside "Confirmed". Cancelled / returned orders have no line
// (the page says it in words). Works the same in Arabic: the line runs from the start side.
export const PROGRESS_STEPS = ['received', 'confirmed', 'shipped', 'delivered'];
const INDEX = { pending: 0, confirmed: 1, processing: 1, shipped: 2, delivered: 3 };

export function progressIndex(status) {
  return Object.prototype.hasOwnProperty.call(INDEX, status) ? INDEX[status] : -1;
}

export default function OrderProgress({ status }) {
  const { t } = useTranslation();
  const current = progressIndex(status);
  if (current < 0) return null;
  return (
    <ol className="mt-5 flex w-full" aria-label={t('progress.label')} data-progress data-progress-current={current}>
      {PROGRESS_STEPS.map((step, i) => {
        const done = i < current || current === 3;
        const here = i === current && current !== 3;
        return (
          <li
            key={step}
            className="relative flex flex-1 flex-col items-center px-1 text-center"
            aria-current={i === current ? 'step' : undefined}
            data-step={step}
            data-state={done ? 'done' : here ? 'current' : 'todo'}
          >
            {i > 0 && (
              <span
                aria-hidden="true"
                className={'absolute start-[-50%] top-[11px] h-0.5 w-full ' + (i <= current ? 'bg-brass' : 'bg-ink/15')}
              />
            )}
            <span
              aria-hidden="true"
              className={
                'relative z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 text-[11px] font-bold ' +
                (done
                  ? 'border-brass bg-brass text-on-brass'
                  : here
                    ? 'border-brass bg-paper text-brass-dark ring-4 ring-brass/20'
                    : 'border-ink/20 bg-paper text-ink-faint')
              }
            >
              {done ? '✓' : i + 1}
            </span>
            <span className={'mt-2 text-xs leading-tight ' + (i <= current ? 'font-medium text-ink' : 'text-ink-faint')}>
              {t(`progress.${step}`)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
