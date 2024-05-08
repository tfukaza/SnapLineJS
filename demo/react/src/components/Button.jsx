import React from 'react';

export default function Button({ buttonText }) {

    function handleClick() {
        console.log("Button Clicked");
    }

    return (
        <button className="sl-btn" onClick={handleClick}>{buttonText}</button>
    );

}

// "dev-react": "rollup --config --watch --environment BUILD_ENV:dev --environment FRAMEWORK_ENV:react & rollup --watch --config demo/react/rollup.config.mjs",
