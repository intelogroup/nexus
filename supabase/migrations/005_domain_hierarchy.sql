-- 005_domain_hierarchy.sql
-- Adds: domains table, domain_ontology table, alters knowledge_graph_nodes

-- ─── 1. DOMAINS TABLE (global, 14 rows, seeded once) ──────────────────────────
CREATE TABLE IF NOT EXISTS domains (
  id   serial      PRIMARY KEY,
  name text        NOT NULL UNIQUE,
  slug text        NOT NULL UNIQUE,
  description text,
  color text,  -- hex, for UI circles
  icon  text   -- emoji or icon name
);

INSERT INTO domains (name, slug, description, color, icon) VALUES
  ('Health & Medicine',            'health',       'Body, mental health, nutrition, fitness, medical conditions',                    '#10b981', '🏥'),
  ('Technology & Computing',       'technology',   'Software, hardware, AI, internet, programming, engineering, devices',           '#3b82f6', '💻'),
  ('Science & Mathematics',        'science',      'Physics, chemistry, biology, math, research, space',                           '#8b5cf6', '🔬'),
  ('Business & Entrepreneurship',  'business',     'Startups, strategy, management, marketing, products, operations',               '#f59e0b', '💼'),
  ('Finance & Economics',          'finance',      'Investing, money, markets, personal finance, crypto, economics',                '#06b6d4', '📈'),
  ('Society, Politics & Law',      'society',      'Government, law, human rights, policy, activism, justice',                     '#ef4444', '⚖️'),
  ('History & Civilization',       'history',      'World history, events, civilizations, archaeology, biographies',                '#d97706', '📜'),
  ('Geography, Nature & Environment','geography',  'Places, climate, ecology, travel, animals, agriculture',                       '#84cc16', '🌍'),
  ('Arts, Culture & Creativity',   'arts',         'Art, music, film, literature, design, fashion, architecture, food culture',    '#ec4899', '🎨'),
  ('Sports, Games & Recreation',   'sports',       'Sports, fitness competitions, video games, board games, hobbies',              '#14b8a6', '⚽'),
  ('Psychology, Philosophy & Spirituality','psychology','Mind, behavior, ethics, philosophy, religion, meditation, self-growth',   '#a78bfa', '🧠'),
  ('Education & Language',         'education',    'Teaching, studying, skills, languages, academia, research methods',            '#f97316', '📚'),
  ('Media, News & Entertainment',  'media',        'News, social media, pop culture, celebrities, TV, podcasts',                   '#6366f1', '📺'),
  ('Lifestyle & Relationships',    'lifestyle',    'Family, dating, parenting, home, food & cooking, daily life, social',          '#fb7185', '🏠')
ON CONFLICT (slug) DO NOTHING;


-- ─── 2. DOMAIN ONTOLOGY TABLE (rulebook for LLM classification) ───────────────
CREATE TABLE IF NOT EXISTS domain_ontology (
  id              serial   PRIMARY KEY,
  subdomain       text     NOT NULL,
  domain_id       integer  NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  aliases         text[]   DEFAULT '{}'
);

CREATE UNIQUE INDEX IF NOT EXISTS domain_ontology_subdomain_domain
  ON domain_ontology (lower(subdomain), domain_id);

-- Health & Medicine (domain 1)
INSERT INTO domain_ontology (subdomain, domain_id, aliases) VALUES
  ('Medicine',            1, ARRAY['general medicine','clinical medicine','medical']),
  ('Mental Health',       1, ARRAY['psychiatry','psychology (clinical)','mental illness','therapy']),
  ('Nutrition & Diet',    1, ARRAY['nutrition','diet','dietary','food science']),
  ('Fitness & Exercise',  1, ARRAY['fitness','exercise','workout','gym','physical training']),
  ('Cardiology',          1, ARRAY['heart disease','cardiovascular','cardiac']),
  ('Neurology',           1, ARRAY['neurology','brain disorders','neurological']),
  ('Pharmacology',        1, ARRAY['medications','drugs','pharmaceuticals','pharmacy']),
  ('Pediatrics',          1, ARRAY['child health','children medicine','pediatric']),
  ('Oncology',            1, ARRAY['cancer','tumor','chemotherapy']),
  ('Public Health',       1, ARRAY['epidemiology','global health','disease prevention']),
  ('Surgery',             1, ARRAY['surgical','operations','surgical procedures'])
ON CONFLICT DO NOTHING;

-- Technology & Computing (domain 2)
INSERT INTO domain_ontology (subdomain, domain_id, aliases) VALUES
  ('Software Development',    2, ARRAY['programming','coding','software engineering','dev']),
  ('Artificial Intelligence', 2, ARRAY['AI','machine learning','ML','deep learning','LLM','NLP']),
  ('Cybersecurity',           2, ARRAY['security','hacking','infosec','pen testing','cyber']),
  ('Networking',              2, ARRAY['networks','TCP/IP','DNS','protocols','internet infrastructure']),
  ('Hardware',                2, ARRAY['computer hardware','chips','CPU','GPU','electronics']),
  ('Mobile Development',      2, ARRAY['iOS','Android','mobile apps','React Native','Flutter']),
  ('Web Development',         2, ARRAY['frontend','backend','fullstack','HTML','CSS','JavaScript']),
  ('Databases',               2, ARRAY['SQL','NoSQL','PostgreSQL','Redis','database design']),
  ('DevOps & Cloud',          2, ARRAY['DevOps','cloud computing','AWS','GCP','Azure','CI/CD','Docker','Kubernetes']),
  ('Computer Science',        2, ARRAY['algorithms','data structures','CS theory','complexity']),
  ('Robotics',                2, ARRAY['robots','automation','mechatronics']),
  ('Blockchain',              2, ARRAY['crypto','NFT','smart contracts','Web3','DeFi'])
ON CONFLICT DO NOTHING;

-- Science & Mathematics (domain 3)
INSERT INTO domain_ontology (subdomain, domain_id, aliases) VALUES
  ('Physics',                3, ARRAY['quantum physics','thermodynamics','mechanics','relativity']),
  ('Chemistry',              3, ARRAY['organic chemistry','biochemistry','chemical reactions']),
  ('Biology',                3, ARRAY['life sciences','ecology','evolution','microbiology']),
  ('Mathematics',            3, ARRAY['math','calculus','algebra','statistics','probability']),
  ('Astronomy & Space',      3, ARRAY['astronomy','astrophysics','cosmology','space exploration']),
  ('Geology & Earth Science',3, ARRAY['geology','geophysics','earth science','volcanology']),
  ('Environmental Science',  3, ARRAY['climate science','atmospheric science','environmental']),
  ('Genetics & Genomics',    3, ARRAY['genetics','DNA','genomics','CRISPR','heredity']),
  ('Neuroscience',           3, ARRAY['brain science','cognitive neuroscience','neurochemistry']),
  ('Materials Science',      3, ARRAY['materials','nanotechnology','polymers','metallurgy'])
ON CONFLICT DO NOTHING;

-- Business & Entrepreneurship (domain 4)
INSERT INTO domain_ontology (subdomain, domain_id, aliases) VALUES
  ('Strategy & Management',  4, ARRAY['business strategy','management','leadership','executives']),
  ('Marketing',              4, ARRAY['marketing','branding','advertising','growth','SEO']),
  ('Sales',                  4, ARRAY['sales','revenue','CRM','B2B','B2C']),
  ('Startups',               4, ARRAY['startup','founder','venture','pitch','MVP']),
  ('Operations',             4, ARRAY['operations','logistics','process','supply chain']),
  ('Human Resources',        4, ARRAY['HR','hiring','recruiting','talent','people ops']),
  ('Product Management',     4, ARRAY['product','PM','roadmap','user stories','agile']),
  ('Leadership',             4, ARRAY['leadership','culture','teams','management'])
ON CONFLICT DO NOTHING;

-- Finance & Economics (domain 5)
INSERT INTO domain_ontology (subdomain, domain_id, aliases) VALUES
  ('Personal Finance',       5, ARRAY['budgeting','saving','personal money','debt','financial planning']),
  ('Investing & Markets',    5, ARRAY['stocks','bonds','portfolio','trading','ETF','dividends']),
  ('Macroeconomics',         5, ARRAY['macroeconomics','GDP','inflation','monetary policy','central banks']),
  ('Cryptocurrency',         5, ARRAY['crypto','bitcoin','ethereum','DeFi','altcoins']),
  ('Banking',                5, ARRAY['banks','credit','loans','mortgages','interest rates']),
  ('Accounting',             5, ARRAY['accounting','bookkeeping','financial statements','tax']),
  ('Real Estate',            5, ARRAY['real estate','property','housing market','REITs']),
  ('Insurance',              5, ARRAY['insurance','risk','underwriting','coverage']),
  ('Microeconomics',         5, ARRAY['microeconomics','supply demand','market structure','pricing'])
ON CONFLICT DO NOTHING;

-- Society, Politics & Law (domain 6)
INSERT INTO domain_ontology (subdomain, domain_id, aliases) VALUES
  ('Politics & Government',  6, ARRAY['politics','government','elections','democracy','political parties']),
  ('Law & Legal System',     6, ARRAY['law','legal','contracts','courts','legislation','compliance']),
  ('Human Rights',           6, ARRAY['human rights','civil rights','social justice','equality']),
  ('International Relations',6, ARRAY['foreign policy','diplomacy','geopolitics','UN','NATO']),
  ('Social Issues',          6, ARRAY['social issues','inequality','poverty','immigration','race']),
  ('Policy & Regulation',    6, ARRAY['policy','regulation','lobbying','legislation']),
  ('Military & Defense',     6, ARRAY['military','defense','war','armed forces','weapons'])
ON CONFLICT DO NOTHING;

-- History & Civilization (domain 7)
INSERT INTO domain_ontology (subdomain, domain_id, aliases) VALUES
  ('Ancient History',        7, ARRAY['ancient','antiquity','Rome','Greece','Egypt','Mesopotamia']),
  ('Medieval History',       7, ARRAY['medieval','middle ages','feudalism','crusades']),
  ('Modern History',         7, ARRAY['modern history','19th century','20th century','contemporary']),
  ('World Wars',             7, ARRAY['WWI','WWII','World War','Cold War','nuclear']),
  ('Cultural History',       7, ARRAY['cultural history','civilization','heritage','traditions']),
  ('Archaeology',            7, ARRAY['archaeology','excavation','artifacts','ancient sites']),
  ('Biographies',            7, ARRAY['biography','historical figures','notable people'])
ON CONFLICT DO NOTHING;

-- Geography, Nature & Environment (domain 8)
INSERT INTO domain_ontology (subdomain, domain_id, aliases) VALUES
  ('Countries & Regions',    8, ARRAY['countries','cities','regions','nations','capitals']),
  ('Climate & Weather',      8, ARRAY['climate','weather','meteorology','seasons','storms']),
  ('Ecology & Ecosystems',   8, ARRAY['ecology','ecosystems','biomes','habitats','biodiversity']),
  ('Zoology & Animals',      8, ARRAY['animals','zoology','wildlife','mammals','birds','fish']),
  ('Botany & Plants',        8, ARRAY['plants','botany','trees','flora','agriculture','gardening']),
  ('Oceanography',           8, ARRAY['ocean','marine','sea','aquatic','coral reefs']),
  ('Travel & Places',        8, ARRAY['travel','tourism','destinations','landmarks','culture travel']),
  ('Natural Disasters',      8, ARRAY['earthquakes','hurricanes','floods','volcanoes','disasters']),
  ('Conservation',           8, ARRAY['conservation','endangered species','sustainability','environment'])
ON CONFLICT DO NOTHING;

-- Arts, Culture & Creativity (domain 9)
INSERT INTO domain_ontology (subdomain, domain_id, aliases) VALUES
  ('Visual Arts',            9, ARRAY['painting','sculpture','drawing','illustration','fine art']),
  ('Music',                  9, ARRAY['music','songs','bands','concerts','genres','instruments']),
  ('Film & Television',      9, ARRAY['movies','films','TV shows','cinema','directors','actors']),
  ('Literature & Writing',   9, ARRAY['books','novels','poetry','writing','authors','fiction']),
  ('Design',                 9, ARRAY['graphic design','UX','UI design','product design','typography']),
  ('Architecture',           9, ARRAY['architecture','buildings','urban design','interiors']),
  ('Fashion',                9, ARRAY['fashion','clothing','style','trends','luxury','brands']),
  ('Food Culture',           9, ARRAY['cuisine','restaurants','chefs','food trends','gastronomy']),
  ('Theater & Performance',  9, ARRAY['theater','theatre','dance','performance art','opera']),
  ('Photography',            9, ARRAY['photography','photos','cameras','editing','photojournalism'])
ON CONFLICT DO NOTHING;

-- Sports, Games & Recreation (domain 10)
INSERT INTO domain_ontology (subdomain, domain_id, aliases) VALUES
  ('Team Sports',            10, ARRAY['football','basketball','soccer','baseball','hockey','rugby']),
  ('Individual Sports',      10, ARRAY['tennis','golf','swimming','athletics','cycling','boxing']),
  ('Esports & Video Games',  10, ARRAY['gaming','esports','video games','PC games','console','mobile games']),
  ('Board Games & Tabletop', 10, ARRAY['board games','chess','card games','tabletop','D&D']),
  ('Outdoor & Adventure',    10, ARRAY['hiking','climbing','camping','surfing','skiing','adventure sports']),
  ('Martial Arts',           10, ARRAY['martial arts','MMA','boxing','wrestling','judo','karate']),
  ('Fantasy Sports',         10, ARRAY['fantasy football','fantasy sports','sports betting','drafts'])
ON CONFLICT DO NOTHING;

-- Psychology, Philosophy & Spirituality (domain 11)
INSERT INTO domain_ontology (subdomain, domain_id, aliases) VALUES
  ('Psychology & Behavior',  11, ARRAY['psychology','behavior','cognitive','personality','behavioral science']),
  ('Philosophy',             11, ARRAY['philosophy','metaphysics','epistemology','logic','stoicism']),
  ('Religion',               11, ARRAY['religion','Christianity','Islam','Judaism','Buddhism','Hinduism','faith']),
  ('Spirituality & Meditation',11,ARRAY['spirituality','meditation','mindfulness','yoga','consciousness']),
  ('Ethics & Morality',      11, ARRAY['ethics','morality','moral philosophy','values']),
  ('Cognitive Science',      11, ARRAY['cognitive science','cognition','perception','memory','learning science']),
  ('Self-Improvement',       11, ARRAY['self-improvement','personal growth','habits','productivity','motivation'])
ON CONFLICT DO NOTHING;

-- Education & Language (domain 12)
INSERT INTO domain_ontology (subdomain, domain_id, aliases) VALUES
  ('Languages & Linguistics',12, ARRAY['language learning','linguistics','Spanish','French','translation','grammar']),
  ('Teaching & Pedagogy',    12, ARRAY['teaching','education methods','pedagogy','curriculum','classroom']),
  ('Higher Education',       12, ARRAY['university','college','degree','academic','PhD','research']),
  ('Learning Strategies',    12, ARRAY['studying','learning','memory','spaced repetition','note-taking']),
  ('Online Learning',        12, ARRAY['e-learning','MOOCs','Coursera','online courses','edtech']),
  ('Academic Research',      12, ARRAY['research methods','papers','citations','peer review','thesis'])
ON CONFLICT DO NOTHING;

-- Media, News & Entertainment (domain 13)
INSERT INTO domain_ontology (subdomain, domain_id, aliases) VALUES
  ('Journalism & News',      13, ARRAY['news','journalism','media','reporting','newspapers']),
  ('Social Media',           13, ARRAY['social media','Twitter','Instagram','TikTok','Facebook','LinkedIn']),
  ('Celebrity & Pop Culture',13, ARRAY['celebrity','pop culture','entertainment news','influencers']),
  ('Streaming & TV',         13, ARRAY['Netflix','streaming','YouTube','podcasts','TV','shows']),
  ('Advertising & PR',       13, ARRAY['advertising','marketing comms','PR','public relations','campaigns']),
  ('Comedy & Satire',        13, ARRAY['comedy','humor','satire','memes','stand-up'])
ON CONFLICT DO NOTHING;

-- Lifestyle & Relationships (domain 14)
INSERT INTO domain_ontology (subdomain, domain_id, aliases) VALUES
  ('Relationships & Dating', 14, ARRAY['relationships','dating','romance','love','breakup','marriage']),
  ('Parenting & Family',     14, ARRAY['parenting','children','family','kids','baby','motherhood']),
  ('Home & Living',          14, ARRAY['home','interior','decoration','household','cleaning','DIY']),
  ('Cooking & Recipes',      14, ARRAY['cooking','recipes','meals','baking','kitchen','food prep']),
  ('Personal Development',   14, ARRAY['self-help','habits','goals','mindset','discipline','time management']),
  ('Fashion & Beauty',       14, ARRAY['fashion','beauty','skincare','makeup','style','grooming']),
  ('Pets & Animals',         14, ARRAY['pets','dogs','cats','animals','veterinary','pet care']),
  ('Travel & Leisure',       14, ARRAY['travel','vacation','trips','leisure','tourism','adventures'])
ON CONFLICT DO NOTHING;


-- ─── 3. ALTER knowledge_graph_nodes ──────────────────────────────────────────

-- Add level column (2 = concept/topic default, 1 = subdomain, 0 = domain virtual)
ALTER TABLE knowledge_graph_nodes
  ADD COLUMN IF NOT EXISTS level     integer  NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS domain_id integer  REFERENCES domains(id) ON DELETE SET NULL;

-- Update node_type CHECK constraint to include 'subdomain'
ALTER TABLE knowledge_graph_nodes
  DROP CONSTRAINT IF EXISTS knowledge_graph_nodes_node_type_check;

ALTER TABLE knowledge_graph_nodes
  ADD CONSTRAINT knowledge_graph_nodes_node_type_check
  CHECK (node_type IN (
    'technology','concept','person','organization','workflow','outcome',
    'knowledge_gap','research_finding','subdomain'
  ));

-- Index for hierarchical queries
CREATE INDEX IF NOT EXISTS idx_kg_nodes_domain_id  ON knowledge_graph_nodes (domain_id)  WHERE domain_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_kg_nodes_level       ON knowledge_graph_nodes (level);
CREATE INDEX IF NOT EXISTS idx_kg_nodes_parent      ON knowledge_graph_nodes (parent_node_id) WHERE parent_node_id IS NOT NULL;
