import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../Components/UI/Card';
import Button from '../../Components/UI/Button';
import { Input } from '../../Components/UI/Input';
import CustomSelect from '../../Components/UI/CustomSelect';
import AssignedKpiList from '../../Components/KPI/AssignedKpiList';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../Components/UI/ProfileButtonTab';
import { Plus, Trash2, Search } from 'lucide-react';

const chairList = [
  'Dr. Abebe Tadesse – Software Engineering',
  'Mr. Kebede Hailu – Electrical Engineering',
  'Ms. Tigist Alemu – Mechanical Engineering',
  'Dr. Solomon Getachew – Civil Engineering',
  'Mr. Dawit Mekonnen – Computing',
];

const kpiOptions = [
  'Research Publications',
  'Course Delivery Quality',
  'Student Mentoring',
  'Lab Management',
  'Community Service',
  'Curriculum Development',
  'Industry Partnership',
  'Graduate Supervision',
];

const unitOptions = ['Number', 'Percentage', 'Score', 'Ratio', 'Count'];
const themes = ['Theme I', 'Theme II', 'Theme III', 'Theme IV'];
const currentFaculty = 'Faculty of Engineering';

const existingKpis = [
  {
    id: 1,
    kpi: 'Research Publications',
    theme: 'Theme II: Research & Innovation',
    chair: 'Dr. Abebe Tadesse',
    faculty: 'Faculty of Engineering',
    measureGroup: 'Academic Excellence',
    value: '20',
    weight: '20%',
    baseline: '3',
    target: '5',
    unit: 'Number',
    measures: ['Journal Papers', 'Conference Papers'],
    remark: 'High priority for research output',
    status: 'active',
  },
  {
    id: 2,
    kpi: 'Course Delivery Quality',
    theme: 'Theme I: Teaching & Learning',
    chair: 'Mr. Kebede Hailu',
    faculty: 'Faculty of Engineering',
    measureGroup: 'Teaching Quality',
    value: '25',
    weight: '25%',
    baseline: '80',
    target: '90',
    unit: 'Percentage',
    measures: ['Student Feedback', 'Peer Review'],
    remark: 'Improving delivery standards',
    status: 'active',
  },
  {
    id: 3,
    kpi: 'Student Mentoring',
    theme: 'Theme I: Student Support',
    chair: 'Ms. Tigist Alemu',
    faculty: 'Faculty of Engineering',
    measureGroup: 'Student Support',
    value: '15',
    weight: '15%',
    baseline: '7',
    target: '10',
    unit: 'Number',
    measures: ['Mentees Assigned'],
    remark: 'Mentoring engagement target',
    status: 'pending',
  },
  {
    id: 4,
    kpi: 'Lab Management',
    theme: 'Theme IV: Infrastructure & Resources',
    chair: 'Dr. Solomon Getachew',
    faculty: 'Faculty of Engineering',
    measureGroup: 'Infrastructure',
    value: '20',
    weight: '20%',
    baseline: '85',
    target: '95',
    unit: 'Percentage',
    measures: ['Equipment Uptime', 'Safety Compliance'],
    remark: 'Facility readiness focus',
    status: 'active',
  },
  {
    id: 5,
    kpi: 'Community Service',
    theme: 'Theme III: Community Engagement',
    chair: 'Mr. Dawit Mekonnen',
    faculty: 'Faculty of Engineering',
    measureGroup: 'Outreach',
    value: '20',
    weight: '20%',
    baseline: '2',
    target: '3',
    unit: 'Count',
    measures: ['Events Organized'],
    remark: 'Community outreach contribution',
    status: 'pending',
  },
];

const AssignKpi = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [themeFilter, setThemeFilter] = useState('all');
  const [selectedKpi, setSelectedKpi] = useState('');
  const [selectedChair, setSelectedChair] = useState('');
  const [measureGroup, setMeasureGroup] = useState('');
  const [value, setValue] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('');
  const [measures, setMeasures] = useState(['']);
  const assignedKpis = existingKpis.filter((k) => k.faculty === currentFaculty);

  const filteredKpis = assignedKpis.filter((k) => {
    const matchesSearch = k.kpi.toLowerCase().includes(searchTerm.toLowerCase()) || k.chair.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTheme = themeFilter === 'all' || k.theme.startsWith(themeFilter);
    return matchesSearch && matchesTheme;
  });

  const displayKpis = filteredKpis.map((k, index) => ({
    id: k.id,
    no: k.no || `${index + 1}`,
    kpi: k.kpi,
    theme: k.theme || 'Theme I: Learning-Teaching',
    subTheme: k.subTheme || k.measureGroup || 'General',
    unit: k.unit,
    weight: k.weight || k.value || 'N/A',
    baseline: k.baseline || 'N/A',
    target: k.target || 'N/A',
    remark: k.remark || k.chair,
  }));

  const addMeasure = () => setMeasures([...measures, '']);

  const removeMeasure = (index) => {
    if (measures.length > 1) {
      setMeasures(measures.filter((_, i) => i !== index));
    }
  };

  const updateMeasure = (index, val) => {
    const updated = [...measures];
    updated[index] = val;
    setMeasures(updated);
  };

  const handleAssign = () => {
    if (!selectedKpi || !selectedChair || !measureGroup || !value || !selectedUnit) {
      alert('Please fill in all required fields');
      return;
    }

    alert(`KPI "${selectedKpi}" assigned to ${selectedChair.split('–')[0].trim()}`);

    setSelectedKpi('');
    setSelectedChair('');
    setMeasureGroup('');
    setValue('');
    setSelectedUnit('');
    setMeasures(['']);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">KPI Assignment</h1>
        <p className="text-sm text-muted-foreground">View and assign KPIs that are assigned to your faculty</p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="view">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="view">View KPI</TabsTrigger>
          <TabsTrigger value="assign">Assign KPI</TabsTrigger>
        </TabsList>

        {/* VIEW TAB */}
        <TabsContent value="view" className="space-y-4 mt-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-end">
            <div className="relative min-w-0 md:w-[280px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search KPIs..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
            </div>
            <div className="flex flex-wrap items-center gap-2 justify-end">
              <Button variant={themeFilter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setThemeFilter('all')}>
                All Themes
              </Button>
              {themes.map((theme) => (
                <Button
                  key={theme}
                  variant={themeFilter === theme ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setThemeFilter(theme)}
                  className="text-xs"
                >
                  {theme.replace('Theme ', '')}
                </Button>
              ))}
            </div>
          </div>

          <AssignedKpiList kpis={displayKpis} />
        </TabsContent>

        {/* ASSIGN TAB */}
        <TabsContent value="assign" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Assign KPI</CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-3 gap-4">
                <CustomSelect options={kpiOptions} value={selectedKpi} onChange={setSelectedKpi} placeholder="Select KPI" />

                <CustomSelect options={chairList} value={selectedChair} onChange={setSelectedChair} placeholder="Select Chair" />

                <Input placeholder="Measure Group" value={measureGroup} onChange={(e) => setMeasureGroup(e.target.value)} />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <Input placeholder="Value" value={value} onChange={(e) => setValue(e.target.value)} />

                <CustomSelect options={unitOptions} value={selectedUnit} onChange={setSelectedUnit} placeholder="Select Unit" />
              </div>

              {/* Measures */}
              <div className="space-y-2">
                {measures.map((m, i) => (
                  <div key={i} className="flex gap-2">
                    <Input placeholder="Measure" value={m} onChange={(e) => updateMeasure(i, e.target.value)} />

                    {i === measures.length - 1 && (
                      <Button onClick={addMeasure} size="icon">
                        <Plus className="w-4 h-4" />
                      </Button>
                    )}

                    {measures.length > 1 && (
                      <Button variant="destructive" onClick={() => removeMeasure(i)} size="icon">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              <Button onClick={handleAssign}>Assign KPI</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AssignKpi;
