import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
const SUPABASE_URL = 'https://euclknvsppptbfclwxqq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_90JbyFsa4BuuyeuLCIActg_yXfbHQ30';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const graduateListEl = document.getElementById('graduateList');
const searchBtn = document.getElementById('searchBtn');

async function loadGraduates(filters = {}) {
    graduateListEl.innerHTML = '<p>Loading graduates...</p>';

    let query = supabase.from('graduates').select('*');

    if (filters.name) query = query.ilike('full_name', `%${filters.name}%`);
    if (filters.skills) query = query.ilike('skills', `%${filters.skills}%`);
    if (filters.qualification) query = query.ilike('qualification', `%${filters.qualification}%`);

    const { data, error } = await query.order('full_name', { ascending: true });

    if (error) {
        graduateListEl.innerHTML = `<p>Error loading graduates: ${error.message}</p>`;
        return;
    }

    if (!data.length) {
        graduateListEl.innerHTML = '<p>No graduates found.</p>';
        return;
    }

    graduateListEl.innerHTML = '';
    data.forEach(grad => {
        const div = document.createElement('div');
        div.className = 'graduate-item';

        const profileImg = grad.profile_pic_url
            ? grad.profile_pic_url
            : 'https://via.placeholder.com/80?text=No+Image';

        div.innerHTML = `
            <img src="${profileImg}" alt="${grad.full_name}">
            <h3>${grad.full_name}</h3>
            <p class="skills"><strong>Skills:</strong> ${grad.skills || 'N/A'}</p>
            <p><strong>Qualification:</strong> ${grad.qualification || 'N/A'}</p>
            <p><strong>Email:</strong> ${grad.email}</p>
            <p><strong>Phone:</strong> ${grad.phone || 'N/A'}</p>
        `;

        graduateListEl.appendChild(div);
    });
}

// Initial load
loadGraduates();

// Search button
searchBtn.addEventListener('click', () => {
    const filters = {
        name: document.getElementById('searchName').value.trim(),
        skills: document.getElementById('searchSkills').value.trim(),
        qualification: document.getElementById('searchQualification').value.trim()
    };
    loadGraduates(filters);
});
