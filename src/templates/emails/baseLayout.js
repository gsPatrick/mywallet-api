/**
 * Base Email Layout
 * Identidade visual: MyWallet (Premium Light Theme)
 */

const baseLayout = (content) => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MyWallet</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #f8f9fa;
            color: #1a1a2e;
        }
        .container {
            max-width: 600px;
            margin: 20px auto;
            background-color: #ffffff;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 4px 20px rgba(0,0,0,0.05);
            border: 1px solid #e9ecef;
        }
        .header {
            padding: 40px 20px;
            text-align: center;
            background-color: #ffffff;
        }
        .logo {
            width: 180px;
            height: auto;
        }
        .content {
            padding: 40px;
            line-height: 1.6;
        }
        .footer {
            padding: 30px;
            text-align: center;
            background-color: #f1f3f5;
            color: #6c757d;
            font-size: 12px;
        }
        .button {
            display: inline-block;
            padding: 14px 28px;
            background-color: #1a1a2e;
            color: #ffffff !important;
            text-decoration: none;
            border-radius: 12px;
            font-weight: 600;
            margin-top: 20px;
        }
        .highlight {
            color: #6366f1;
            font-weight: 600;
        }
        .divider {
            height: 1px;
            background-color: #e9ecef;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <img src="https://mywallet.codebypatrick.dev/images/logoparafundobranco.png" alt="MyWallet" class="logo">
        </div>
        
        <div class="content">
            ${content}
        </div>
        
        <div class="footer">
            <p>&copy; ${new Date().getFullYear()} MyWallet. Todos os direitos reservados.</p>
            <p>Sua liberdade financeira começa aqui.</p>
            <div style="margin-top: 10px;">
                <a href="https://mywallet.codebypatrick.dev" style="color: #6c757d; text-decoration: underline;">Acesse sua conta</a>
            </div>
        </div>
    </div>
</body>
</html>
`;

module.exports = baseLayout;
