# Orchard Trail Nutrition — GoDaddy edition

This folder is the whole website: a static public page plus a PHP + MySQL dashboard at
`/admin`. No Cloudflare, no Worker, no Node. It runs on GoDaddy Web Hosting
(cPanel / Apache, PHP 8.3, MySQL).

```
index.html            the public page (rewritten every time Laura publishes)
styles.css, app.js    the public site's stylesheet and script
assets/, media/       photos (media/ is where new uploads land)
robots.txt, sitemap.xml
admin/                the dashboard (same look and behaviour as before)
shared/               page builder + helpers, used by the dashboard in the browser
api/                  PHP back end: accounts, saving, publishing, photos, analytics
config.php            your database details (created from config.sample.php)
.htaccess             routing for /api, security headers, caching
```

## 1. What the hosting plan needs

- GoDaddy **Web Hosting** (cPanel), any tier. PHP 8.3 is GoDaddy's default.
- One **MySQL database** — created in cPanel, free with the plan.

You do **not** need Node.js Hosting, WordPress, or any paid add-on.

## 2. Create the database (cPanel)

1. cPanel → **MySQL Databases** → create a database, e.g. `otn_site`.
2. Create a user with a strong password, e.g. `otn_user`.
3. Add the user to the database with **All privileges**.
4. Write down the four values: host (`localhost`), database name, user, password.
   cPanel usually prefixes both names with your account, e.g. `cpaneluser_otn_site`.

Tables are created automatically on the first visit; there is nothing to import.

## 3. Upload

1. cPanel → **File Manager** → open `public_html`.
2. Upload `godaddy-upload.zip` (or this folder as a zip) and choose **Extract**.
3. Result: `public_html/index.html`, `public_html/api/…`, `public_html/admin/…`.
   The `.htaccess` file must be extracted too — File Manager hides dotfiles until
   you enable **Settings → Show hidden files**.

## 4. Connect the database

1. In File Manager, copy `config.sample.php` to `config.php`.
2. Edit `config.php` and fill in the four MySQL values from step 2, plus
   `site_url` (`https://orchardtrailnutrition.com`).
3. Change `analytics_salt` to any long random text, once.
4. Save. `config.php` is blocked from the browser by `.htaccess`.

Permissions: folders `755`, files `644`. If publishing reports that the page could not
be written, set `public_html` (and `media/`) to `775`.

## 5. First sign-in

Open `https://orchardtrailnutrition.com/admin` — the one-time **create your account**
screen appears. Choose the owner's name, email and password, and save the recovery code
it shows (it is the only way back in if the password is forgotten; no email is sent).

After that, `/admin` is always email + password. The dashboard is the same one you have
used: Website, Drinks, Seasonal, Photos, Business, Design, SEO & Settings, Analytics.

## 6. Publishing

**Publish** writes the finished page to `index.html` and refreshes `sitemap.xml`, so the
public site stays plain static HTML — fast, and nothing to go down. Until you publish,
visitors keep seeing the previous page, and the editor preview shows the draft only.

## Moving the dashboard off `/admin`

Edit `config.php` → `'admin_path' => '/manage'`, then rename the `admin` folder to
`manage`. The dashboard itself needs no changes.

## Backups

**Settings → Download a backup** gives one JSON file with the published page, the draft,
every saved version and the photo list. Photo files themselves live in `media/` — copy
that folder to keep them (cPanel → Backup, or File Manager → Compress).

## What this edition does not have

- **No emailed password reset.** A one-time recovery code is used instead (Account &
  Security → Generate a new code). Adding email means a GoDaddy mailbox plus an SMTP
  library; ask if you want it.
- **No Cloudflare CDN or WAF.** GoDaddy serves the site; HTTPS comes from the hosting
  plan's certificate.
- **No automatic daily database backup.** Use cPanel → Backup, or the JSON export above.

## Local test (for developers)

```
php -S 127.0.0.1:8791 -t . ../tools/php-dev-router.php     # from this folder
BASE=http://127.0.0.1:8791 node ../tools/test-php.mjs       # 46 checks
```

With `driver => 'sqlite'` in a throwaway config, the same code runs without MySQL.
