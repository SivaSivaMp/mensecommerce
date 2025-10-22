import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

export const setupViews = (app) => {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    app.set('view engine', 'ejs');
    app.set('views', [
        path.join(__dirname, '../views/user'),
        path.join(__dirname, '../views/admin'),
    ]);
};
