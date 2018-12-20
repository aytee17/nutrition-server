const nodemailer = require("nodemailer");
const queryDatabase = require("./Database");

exports.registered = async email => {
    const emailExists = await queryDatabase(
        "SELECT id FROM users WHERE email=%L",
        email.toLowerCase()
    );
    return emailExists.rowCount == 1;
};

exports.createSender = ({ transport, from }) => {
    const transporter = nodemailer.createTransport(transport, { from });
    transporter
        .verify()
        .then(success => {
            console.log("SMTP server is ready to take messages");
        })
        .catch(error => {
            console.log(error);
            process.exit(1);
        });

    const generateReset = link => {
        return {
            subject: "Reset your Password",
            text: `Click on this link to reset your password ${link}`,
            html: `<a href="${link}"">Reset Password</a>`
        };
    };

    const generateVerification = link => {
        return {
            subject: "Verify Your Email Address",
            text: `Click on this link to verify your email address ${link}`,
            html: `<a href="${link}"">Verify Email</a>`
        };
    };

    return async (category, email, id, hashID, hash) => {
        const options = { verify: generateVerification, reset: generateReset };
        const link = `https://www.nutritiontrackr.app/${category}/${id}/${hashID}/${hash}`;
        const info = await transporter.sendMail({
            to: email,
            ...options[category](link)
        });
        return info;
    };
};
