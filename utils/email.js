import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();
export async function sendVerificationEmail(email, otp) {
    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            port: 465,
            secure: true,
            requireTLS: true,
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD,
            },
        });

        const info = await transporter.sendMail({
            from: 'ecomus store Ecommerce Website',
            to: email,
            subject: 'Verify your account',
            text: `Your OTP is ${otp}`,
            html: `<b>Your OTP is: ${otp}. It is valid for one minute.</b>`,
            replyTo: process.env.NODEMAILER_EMAIL,
        });

        console.log('Email sent:', info.response);
        return info.accepted.length > 0;
    } catch (error) {
        console.error('Error sending email:', error);
        return false;
    }
}

export async function sendContactEmail(name, email, message) {
    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            port: 465,
            secure: true,
            requireTLS: true,
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD,
            },
        });

        const info = await transporter.sendMail({
            from: `"Ecomus Contact" <${process.env.NODEMAILER_EMAIL}>`,
            to: process.env.NODEMAILER_EMAIL, // Admin receives it
            replyTo: email, // Clicking reply replies to user
            subject: `New Contact Message from ${name}`,
            html: `
                <p><strong>Name:</strong> ${name}</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Message:</strong><br>${message.replace(
                    /\n/g,
                    '<br>'
                )}</p>
            `,
        });

        console.log('Contact email sent:', info.response);
        return info.accepted.length > 0;
    } catch (error) {
        console.error('Error sending contact email:', error);
        return false;
    }
}
