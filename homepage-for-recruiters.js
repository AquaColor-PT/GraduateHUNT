import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
const SUPABASE_URL = 'https://euclknvsppptbfclwxqq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_90JbyFsa4BuuyeuLCIActg_yXfbHQ30';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const graduateListEl = document.getElementById('graduateList');
const resultCountEl = document.getElementById('resultCount');
const searchBtn = document.getElementById('searchBtn');
const clearBtn = document.getElementById('clearBtn');

const inputs = {
    name: document.getElementById('searchName'),
    skills: document.getElementById('searchSkills'),
    qualification: document.getElementById('searchQualification'),
    gender: document.getElementById('searchGender'),
    race: document.getElementById('searchRace'),
    disability: document.getElementById('searchDisability'),
    minAge: document.getElementById('searchMinAge'),
    maxAge: document.getElementById('searchMaxAge')
};

// Simple grey avatar used when a graduate has no profile picture
const PLACEHOLDER_IMG = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="88" height="88" viewBox="0 0 88 88">' +
    '<rect width="88" height="88" fill="#eef3ff"/>' +
    '<circle cx="44" cy="34" r="15" fill="#b9c6e8"/>' +
    '<path d="M14 80c2-16 15-26 30-26s28 10 30 26z" fill="#b9c6e8"/></svg>'
);

// Stops names and other saved text from being treated as HTML
function esc(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function calcAge(dobStr) {
    if (!dobStr) return null;
    const dob = new Date(dobStr);
    if (isNaN(dob)) return null;
    const now = new Date();
    let age = now.getFullYear() - dob.getFullYear();
    const m = now.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
    return age;
}

// YYYY-MM-DD in local time
function isoDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

async function loadGraduates(filters = {}) {
    graduateListEl.innerHTML = '<p>Loading graduates...</p>';
    resultCountEl.textContent = '';

    let query = supabase.from('graduates').select('*');

    if (filters.name) query = query.ilike('full_name', `%${filters.name}%`);
    if (filters.skills) query = query.ilike('skills', `%${filters.skills}%`);
    if (filters.qualification) query = query.ilike('qualification', `%${filters.qualification}%`);
    if (filters.gender) query = query.eq('gender', filters.gender);
    if (filters.race) query = query.eq('race', filters.race);
    if (filters.disability) query = query.eq('disability_status', filters.disability);

    // Age filters work on date of birth. Graduates with no date of birth are left out when an age filter is used.
    const today = new Date();
    if (filters.minAge !== undefined) {
        // At least minAge: born on or before this date
        const latestDob = new Date(today.getFullYear() - filters.minAge, today.getMonth(), today.getDate());
        query = query.lte('date_of_birth', isoDate(latestDob));
    }
    if (filters.maxAge !== undefined) {
        // At most maxAge: born after this date
        const earliestDob = new Date(today.getFullYear() - filters.maxAge - 1, today.getMonth(), today.getDate());
        query = query.gt('date_of_birth', isoDate(earliestDob));
    }

    const { data, error } = await query.order('full_name', { ascending: true });

    if (error) {
        graduateListEl.innerHTML = `<p>Error loading graduates: ${esc(error.message)}</p>`;
        return;
    }

    if (!data.length) {
        graduateListEl.innerHTML = '<p>No graduates found.</p>';
        return;
    }

    resultCountEl.textContent = `${data.length} graduate${data.length === 1 ? '' : 's'} found`;
    graduateListEl.innerHTML = '';

    data.forEach(grad => {
        const div = document.createElement('div');
        div.className = 'graduate-item';

        const profileImg = grad.profile_pic_url ? grad.profile_pic_url : PLACEHOLDER_IMG;
        const age = calcAge(grad.date_of_birth);

        div.innerHTML = `
            <img src="${esc(profileImg)}" alt="${esc(grad.full_name)}">
            <h3>${esc(grad.full_name)}</h3>
            <p class="skills"><strong>Skills:</strong> ${esc(grad.skills || 'N/A')}</p>
            <p><strong>Qualification:</strong> ${esc(grad.qualification || 'N/A')}</p>
            <div class="divider"></div>
            <p><strong>Age:</strong> ${age !== null && age >= 0 ? esc(age) : 'N/A'}</p>
            <p><strong>Gender:</strong> ${esc(grad.gender || 'N/A')}</p>
            <p><strong>Race:</strong> ${esc(grad.race || 'N/A')}</p>
            <p><strong>Disability status:</strong> ${esc(grad.disability_status || 'N/A')}</p>
            <div class="divider"></div>
            <p><strong>Email:</strong> ${esc(grad.email)}</p>
            <p><strong>Phone:</strong> ${esc(grad.phone || 'N/A')}</p>
        `;

        // Fall back to the placeholder if a profile picture link is broken
        div.querySelector('img').addEventListener('error', (e) => {
            e.target.src = PLACEHOLDER_IMG;
        }, { once: true });

        graduateListEl.appendChild(div);
    });
}

function readFilters() {
    const filters = {
        name: inputs.name.value.trim(),
        skills: inputs.skills.value.trim(),
        qualification: inputs.qualification.value.trim(),
        gender: inputs.gender.value,
        race: inputs.race.value,
        disability: inputs.disability.value
    };

    const min = parseInt(inputs.minAge.value, 10);
    const max = parseInt(inputs.maxAge.value, 10);
    if (!isNaN(min) && min >= 0) filters.minAge = min;
    if (!isNaN(max) && max >= 0) filters.maxAge = max;

    return filters;
}

function runSearch() {
    const filters = readFilters();
    if (filters.minAge !== undefined && filters.maxAge !== undefined && filters.minAge > filters.maxAge) {
        graduateListEl.innerHTML = '<p>Minimum age cannot be higher than maximum age.</p>';
        resultCountEl.textContent = '';
        return;
    }
    loadGraduates(filters);
}

// Initial load
loadGraduates();

// Search button
searchBtn.addEventListener('click', runSearch);

// Pressing Enter in any text or number box also searches
Object.values(inputs).forEach(el => {
    if (el.tagName === 'INPUT') {
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') runSearch();
        });
    }
});

// Clear button
clearBtn.addEventListener('click', () => {
    Object.values(inputs).forEach(el => { el.value = ''; });
    loadGraduates();
});
