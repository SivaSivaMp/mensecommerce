// --- Grab elements ---
const nameid = document.getElementById('property1');
const emailid = document.getElementById('property3');
const passid = document.getElementById('property4');
const cpassid = document.getElementById('property5');

const error1 = document.getElementById('error-1'); // name
const error2 = document.getElementById('error-2'); // email
const error3 = document.getElementById('error-3'); // password
const error4 = document.getElementById('error-4'); // confirm password

const signform = document.getElementById('register-form');
const loginform = document.getElementById('login-form');

// --- Name validation ---
function nameValidateChecking() {
    const nameval = nameid.value.trim();
    const namepattern = /^[A-Za-z\s]+$/;

    if (nameval === '') {
        error1.style.display = 'block';
        error1.innerHTML = 'Please enter your full name';
    } else if (!namepattern.test(nameval)) {
        error1.style.display = 'block';
        error1.innerHTML = 'Name must contain only letters and spaces';
    } else {
        error1.style.display = 'none';
        error1.innerHTML = '';
    }
}

function emailValidateChecking() {
    const emailval = emailid.value.trim();
    const emailpattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    if (!emailpattern.test(emailval)) {
        error2.style.display = 'block';
        error2.innerHTML = 'Please enter a valid email address';
    } else {
        error2.style.display = 'none';
        error2.innerHTML = '';
    }
}

function passValidateChecking(isLogin = false) {
    const passval = passid.value;
    const cpassval = cpassid.value;
    const alpha = /[a-zA-Z]/;
    const digit = /\d/;

    if (passval.length < 8) {
        error3.style.display = 'block';
        error3.innerHTML = 'Password must be at least 8 characters';
    } else if (!alpha.test(passval) || !digit.test(passval)) {
        error3.style.display = 'block';
        error3.innerHTML = 'Password must contain both letters and numbers';
    } else {
        error3.style.display = 'none';
        error3.innerHTML = '';
    }

    if (passval !== cpassval) {
        error4.style.display = 'block';
        error4.innerHTML = 'Passwords do not match';
    } else {
        error4.style.display = 'none';
        error4.innerHTML = '';
    }
}

// --- On form submit ---
if (signform) {
    signform.addEventListener('submit', (e) => {
        nameValidateChecking();
        emailValidateChecking();
        passValidateChecking(false);

        if (
            (error1 && error1.innerHTML) ||
            (error2 && error2.innerHTML) ||
            (error3 && error3.innerHTML) ||
            (error4 && error4.innerHTML)
        ) {
            e.preventDefault(); // stop submission
        }
    });
}
