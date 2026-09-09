import React from 'react';
const config = require('../wikitdb.config.js');

const Footer = () => {
    const year = new Date().getFullYear();
    const since = config.SITE_SINCE;
    const copyrightDate =
        parseInt(since) < year ? since + '-' + year : year;

    return (
        <>
            <footer className="relative bg-sunken border-t border-line py-8 text-sm font-medium text-fg-3 text-center">
                {`© ${copyrightDate} - `}{config.SITE_AUTHOR}
            </footer>
        </>
    );
};

export default Footer;
