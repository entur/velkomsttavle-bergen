import { base } from '@entur/tokens';
import { Heading3, Paragraph } from '@entur/typography';

const BORDER = base.light.baseColors.stroke.subduedalt;

/**
 * Rammen rundt én av de fire seksjonene i oppsettskjemaet.
 *
 * Seksjonene speiler de fire feltene på tavla og skal leses som fire ting, ikke
 * som én lang liste. Rammen er hele poenget: uten den fløt fargevelkerne og
 * modulvalgene over i hverandre.
 */
function FormSection({ title, help, children }) {
    return (
        <section
            style={{
                border: `1px solid ${BORDER}`,
                borderRadius: '0.5rem',
                padding: '1.25rem 1.5rem 1.5rem',
            }}
        >
            <Heading3>{title}</Heading3>
            {help && <Paragraph>{help}</Paragraph>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {children}
            </div>
        </section>
    );
}

export default FormSection;
